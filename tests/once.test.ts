import assert from "node:assert/strict";
import test from "node:test";
import { compileRules, filterFirstOccurrenceMatches, findMatches, firstMatchesByRule } from "../src/highlighters/matching";
import { getEffectiveQueries } from "../src/settings/groups";
import { normalizeSettings } from "../src/settings/settings";

void test("once rules keep only the first resolved occurrence of the whole document", () => {
  const text = "博士：你好\n凯尔希：早\n博士：再见";
  const rules = compileRules({
    doctor: { query: "博士", regex: false, decorateOnce: true },
    kelsi: { query: "凯尔希", regex: false },
  }, ["doctor", "kelsi"]);
  const first = firstMatchesByRule(text, rules);
  assert.deepEqual([...first.keys()], ["doctor"]);
  const target = first.get("doctor")!;
  assert.deepEqual([target.from, target.to], [0, 2]);
  // Every later occurrence of the once rule is dropped; other rules are untouched.
  const kept = findMatches(text, rules).filter(match => {
    if (!match.rule.decorateOnce) return true;
    const expected = first.get(match.ruleId)!;
    return match.from === expected.from && match.to === expected.to;
  }).map(match => [match.ruleId, text.slice(match.from, match.to)]);
  assert.deepEqual(kept, [["doctor", "博士"], ["kelsi", "凯尔希"]]);
});

void test("once rules pick the first match of any term and survive exclusion of the raw first", () => {
  const text = "alpha beta alpha";
  const rules = compileRules({ pair: { query: "alpha\nbeta", queryMode: "keywords", regex: false, decorateOnce: true } }, ["pair"]);
  const plain = firstMatchesByRule(text, rules);
  assert.deepEqual([plain.get("pair")!.from, plain.get("pair")!.to], [0, 5]);
  // A protected (excluded) first occurrence defers the decoration to the next eligible match.
  const excluded = firstMatchesByRule(text, rules, match => match.from > 0);
  assert.deepEqual([excluded.get("pair")!.from, excluded.get("pair")!.to], [6, 10]);
  assert.equal(firstMatchesByRule(text, compileRules({ plain: { query: "alpha", regex: false } }, ["plain"])).size, 0);
});

void test("filterFirstOccurrenceMatches maps block occurrences onto document ordinals", () => {
  const rules = compileRules({ doctor: { query: "博士", regex: false, decorateOnce: true } }, ["doctor"]);
  const targets = new Map([["doctor", { text: "博士", ordinal: 0 }]]);
  const firstBlockText = "博士：一";
  assert.deepEqual(filterFirstOccurrenceMatches(findMatches(firstBlockText, rules), firstBlockText, targets, "", 0).length, 1);
  // The third block starts after two earlier occurrences (base 2), so it is not the document's first.
  const thirdBlockText = "博士：三";
  assert.deepEqual(filterFirstOccurrenceMatches(findMatches(thirdBlockText, rules), thirdBlockText, targets, "博士 博士", 5).length, 0);
  // Without section information every occurrence stays visible instead of losing decorations.
  assert.deepEqual(filterFirstOccurrenceMatches(findMatches(thirdBlockText, rules), thirdBlockText, targets, "", null).length, 1);
});

void test("filterFirstOccurrenceMatches ignores other rules and text mismatches", () => {
  const rules = compileRules({
    doctor: { query: "博士", regex: false, decorateOnce: true },
    kelsi: { query: "凯尔希", regex: false },
  }, ["doctor", "kelsi"]);
  const targets = new Map([["doctor", { text: "博士", ordinal: 0 }]]);
  const blockText = "博士与凯尔希";
  const kept = filterFirstOccurrenceMatches(findMatches(blockText, rules), blockText, targets, "", 0);
  assert.deepEqual(kept.map(match => match.ruleId), ["doctor", "kelsi"]);
  // A once-rule match rendering different text than the document-level target is dropped.
  const multi = compileRules({ pair: { query: "alpha\nbeta", queryMode: "keywords", regex: false, decorateOnce: true } }, ["pair"]);
  assert.deepEqual(filterFirstOccurrenceMatches(findMatches("beta gamma", multi), "beta gamma", new Map([["pair", { text: "alpha", ordinal: 0 }]]), "", 0).length, 0);
});

void test("image sizes accept px and em and normalize into the stored form", () => {
  const settings = normalizeSettings({ staticHighlighter: {
    queries: {
      sized: { query: "word", regex: false, prefixType: "image", imageWidth: "1.5em", imageHeight: "32px", imageCornerRadius: "0.75em", decorateOnce: true },
      broken: { query: "word", regex: false, prefixType: "image", imageWidth: "2rem", imageHeight: 900, imageCornerRadius: -4, decorateOnce: "yes" },
    },
    queryOrder: ["sized", "broken"],
  } });
  const sized = settings.staticHighlighter.queries.sized;
  assert.equal(sized.imageWidth, "1.5em");
  assert.equal(sized.imageHeight, 32);
  assert.equal(sized.imageCornerRadius, "0.75em");
  assert.equal(sized.decorateOnce, true);
  const broken = settings.staticHighlighter.queries.broken;
  assert.equal(broken.imageWidth, undefined);
  assert.equal(broken.imageHeight, undefined);
  assert.equal(broken.imageCornerRadius, undefined);
  assert.equal(broken.decorateOnce, undefined);
});

void test("group styles normalize once flags and em sizes while inheritance keeps defaults", () => {
  const settings = normalizeSettings({ staticHighlighter: {
    queries: { member: { query: "word", regex: false, groupId: "g" } },
    queryOrder: ["member"],
    groups: { g: { name: "Group", style: { decorateOnce: true, imageWidth: "2em", imageCornerRadius: 16 } } },
    groupOrder: ["g"],
  } });
  const style = settings.staticHighlighter.groups?.g.style;
  assert.equal(style?.decorateOnce, true);
  assert.equal(style?.imageWidth, "2em");
  assert.equal(style?.imageCornerRadius, 16);
  const effective = getEffectiveQueries(settings.staticHighlighter).member;
  assert.equal(effective.decorateOnce, true);
  assert.equal(effective.imageWidth, "2em");
  const plain = getEffectiveQueries(normalizeSettings({ staticHighlighter: { queries: { lone: { query: "word", regex: false } }, queryOrder: ["lone"] } }).staticHighlighter).lone;
  assert.equal(plain.decorateOnce, false);
});

void test("once target budgets are independent even when earlier once rules consume 5000 candidates", () => {
  const queries: Record<string, { query: string; regex: boolean; decorateOnce: boolean }> = {};
  const parts: string[] = [];
  for (let index = 0; index < 6; index++) {
    queries[`rule-${index}`] = { query: `word-${index}`, regex: false, decorateOnce: true };
    parts.push(`${`word-${index} `.repeat(1000)}\n`);
  }
  const text = parts.join("");
  const targets = firstMatchesByRule(text, compileRules(queries, Object.keys(queries)));
  assert.equal(targets.size, 6);
  for (const [id, target] of targets) assert.equal(target.from, text.indexOf(queries[id].query));
});
