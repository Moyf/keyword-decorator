import assert from "node:assert/strict";
import test from "node:test";
import { compileRules, findMatches, findMatchesInRanges, MAX_REGEX_PATTERN_LENGTH } from "../src/highlighters/matching";

void test("keywords accepts one or several lines while treating commas literally", () => {
  const text = "red blue | red, blue | sky";
  const rules = compileRules({words:{query:"red, blue\nsky",queryMode:"keywords",regex:false}}, ["words"]);
  assert.deepEqual(findMatches(text, rules).map(match => text.slice(match.from, match.to)), ["red, blue", "sky"]);
  assert.equal(findMatches("sky", compileRules({one:{query:"sky",queryMode:"keywords",regex:false}},["one"])).length, 1);
});

void test("legacy single and comma-separated multiple rules retain their meaning", () => {
  const text = "a,b";
  assert.deepEqual(findMatches(text,compileRules({legacy:{query:text,queryMode:"single",regex:false}},["legacy"])).map(match=>text.slice(match.from,match.to)),["a,b"]);
  assert.deepEqual(findMatches(text,compileRules({legacy:{query:text,queryMode:"multiple",regex:false}},["legacy"])).map(match=>text.slice(match.from,match.to)),["a","b"]);
});

void test("compileRules skips disabled rules and preserves query-order priority", () => {
  const rules = compileRules({
    first: { query: "word", regex: false },
    disabled: { query: "word", regex: false, enabled: false },
    third: { query: "word", regex: false },
  }, ["first", "disabled", "third"]);
  assert.deepEqual(rules.map(rule => [rule.ruleId, rule.priority]), [["first", 0], ["third", 2]]);
});

void test("findMatches resolves overlapping results by query order", () => {
  const rules = compileRules({
    first: { query: "keyword", regex: false },
    second: { query: "key", regex: false },
  }, ["first", "second"]);
  const matches = findMatches("keyword", rules);
  assert.deepEqual(matches.map(match => [match.ruleId, match.from, match.to]), [["first", 0, 7]]);
});

void test("zero-length regex matches advance and are ignored", () => {
  const rules = compileRules({ lookahead: { query: "(?=a)", regex: true, queryMode: "regex" } }, ["lookahead"]);
  assert.deepEqual(findMatches("aaaa", rules), []);
});

void test("protected matches do not suppress an eligible fallback rule", () => {
  const text = "keyword [link](https://example.test)";
  const rules = compileRules({
    broad: { query: "keyword.*", regex: true },
    fallback: { query: "keyword", regex: false },
  }, ["broad", "fallback"]);
  assert.deepEqual(findMatches(text, rules, match => match.to <= 7).map(match => match.ruleId), ["fallback"]);
  const reading = "keyword \u0000";
  assert.deepEqual(findMatches(reading, rules, match => !reading.slice(match.from, match.to).includes("\u0000"))
    .map(match => match.ruleId), ["fallback"]);
});

void test("viewport eligibility uses absolute document offsets before priority selection", () => {
  const text = "header\nkeyword [link](https://example.test)\nfooter";
  const rules = compileRules({
    broad: { query: "keyword.*", regex: true },
    fallback: { query: "keyword", regex: false },
  }, ["broad", "fallback"]);
  const matches = findMatchesInRanges(text, [{ from: 9, to: 12 }], rules, match => match.from >= 7 && match.to <= 14);
  assert.deepEqual(matches.map(match => [match.ruleId, match.from, match.to]), [["fallback", 7, 14]]);
});

void test("oversized regex patterns are skipped while bounded regexes compile", () => {
  const rules = compileRules({
    tooLong: { query: "a".repeat(MAX_REGEX_PATTERN_LENGTH + 1), regex: true, queryMode: "regex" },
    allowed: { query: "a+", regex: true, queryMode: "regex" },
  }, ["tooLong", "allowed"]);
  assert.deepEqual(rules.map(rule => rule.ruleId), ["allowed"]);
  assert.equal(findMatches("aaa", rules)[0].to, 3);
});

void test("multiline regex rules match text across line breaks", () => {
  const rules = compileRules({ multiline: { query: "first\\nsecond", regex: true, queryMode: "regex" } }, ["multiline"]);
  const matches = findMatches("before first\nsecond after", rules);
  assert.deepEqual(matches.map(match => [match.from, match.to]), [[7, 19]]);
});

void test("regex start and end anchors match every logical line", () => {
  const rules = compileRules({ anchored: { query: "^pain$", regex: true, queryMode: "regex" } }, ["anchored"]);
  const text = "header\npain\nfooter";
  assert.deepEqual(findMatches(text, rules).map(match => [match.from, match.to]), [[7, 11]]);
});

void test("visible clipped ranges use real line boundaries for regex anchors", () => {
  const rules = compileRules({ anchored: { query: "^pain", regex: true, queryMode: "regex" } }, ["anchored"]);
  const text = "prefix pain suffix\npain other";
  assert.deepEqual(findMatchesInRanges(text, [{ from: 7, to: 13 }], rules), []);
  assert.deepEqual(findMatchesInRanges(text, [{ from: 21, to: 22 }], rules).map(match => [match.from, match.to]), [[19, 23]]);
});
