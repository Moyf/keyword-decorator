import assert from "node:assert/strict";
import test from "node:test";
import { EMOJI_SHORTCODES } from "../src/emoji/data";
import { lookupEmojiShortcode } from "../src/emoji/shortcodes";
import { compileRules, findMatches, findMatchesInRanges } from "../src/highlighters/matching";
import { getEffectiveQueries } from "../src/settings/groups";
import { installDefaultPresets } from "../src/settings/presets";
import { normalizeSettings, SearchQuery } from "../src/settings/settings";
import { ExportModal } from "../src/settings/export";
import { applySettingsImport, parseSettingsImport } from "../src/settings/import";

function preset() {
  const settings = normalizeSettings(undefined);
  installDefaultPresets(settings.staticHighlighter);
  return settings;
}

void test("shortcodes resolve Unicode sequences, aliases, signs and the friendly happy alias", () => {
  assert.equal(lookupEmojiShortcode(":smile:"), "😄");
  assert.equal(lookupEmojiShortcode(":happy:"), "😄");
  assert.equal(lookupEmojiShortcode(":heart:"), "❤️");
  assert.equal(lookupEmojiShortcode(":+1:"), "👍");
  assert.equal(lookupEmojiShortcode(":-1:"), "👎");
  assert.equal(lookupEmojiShortcode(":family_man_woman_girl_boy:"), "👨‍👩‍👧‍👦");
  for (const invalid of [":constructor:", ":__proto__:", ":toString:", ":not_an_emoji:", ":SMILE:", "smile", ":smile", "smile:"])
    assert.equal(lookupEmojiShortcode(invalid), undefined, invalid);
});

void test("one preset rule covers every bundled alias without mutating stored rules", () => {
  const settings = preset();
  const config = settings.staticHighlighter;
  const before = JSON.stringify(config);
  const rules = compileRules(getEffectiveQueries(config), config.queryOrder);
  assert.equal(rules.length, 1);
  const entries = Object.entries(EMOJI_SHORTCODES);
  assert.equal(entries.length, 1914);
  for (let start = 0; start < entries.length; start += 400) {
    const batch = entries.slice(start, start + 400);
    const text = batch.map(([name]) => `:${name}:`).join(" ");
    const matches = findMatches(text, rules);
    assert.deepEqual(matches.map(match => (match.rule as SearchQuery).prefixValue), batch.map(([, emoji]) => emoji));
    assert.ok(matches.every(match => match.rule.hideText));
  }
  assert.equal(JSON.stringify(config), before);
});

void test("unknown and adjacent shortcodes preserve offsets and do not shadow ordinary rules", () => {
  const config = preset().staticHighlighter;
  config.queries.unknown = { query: ":unknown:", regex: false };
  config.queryOrder.push("unknown");
  const rules = compileRules(getEffectiveQueries(config), config.queryOrder);
  const text = ":unknown: :smile::heart: :unknown:happy:";
  assert.deepEqual(findMatches(text, rules).map(match => [text.slice(match.from, match.to), (match.rule as SearchQuery).prefixValue]), [
    [":unknown:", undefined], [":smile:", "😄"], [":heart:", "❤️"], [":happy:", "😄"],
  ]);
  assert.equal(findMatchesInRanges("prefix :smile: suffix", [{ from: 9, to: 10 }], rules)[0]?.from, 7);
});

void test("existing rule priority and group switches also apply to the preset", () => {
  const config = preset().staticHighlighter;
  config.queries.custom = { query: ":smile:", regex: false, prefixType: "emoji", prefixValue: "🌟" };
  config.queryOrder.unshift("custom");
  assert.equal(findMatches(":smile:", compileRules(getEffectiveQueries(config), config.queryOrder))[0].ruleId, "custom");
  config.groups![config.groupOrder![0]].enabled = false;
  assert.deepEqual(findMatches(":heart:", compileRules(getEffectiveQueries(config), config.queryOrder)), []);
});

void test("preset installation preserves user data, handles ID collisions and runs only once", () => {
  const settings = normalizeSettings({ staticHighlighter: {
    queries: { "preset-emoji-shortcodes": { query: "mine", regex: false } }, queryOrder: ["preset-emoji-shortcodes"],
    groups: { "preset-emoji-shortcodes": { name: "Mine" } }, groupOrder: ["preset-emoji-shortcodes"],
  } });
  const config = settings.staticHighlighter;
  assert.equal(installDefaultPresets(config), true);
  assert.deepEqual(config.queryOrder, ["preset-emoji-shortcodes", "preset-emoji-shortcodes-2"]);
  assert.equal(config.queries[config.queryOrder[0]].query, "mine");
  config.groups!["preset-emoji-shortcodes-2"].name = "Renamed";
  config.groups!["preset-emoji-shortcodes-2"].enabled = false;
  assert.equal(installDefaultPresets(normalizeSettings(settings).staticHighlighter), false);
  delete config.queries["preset-emoji-shortcodes-2"];
  delete config.groups!["preset-emoji-shortcodes-2"];
  assert.equal(installDefaultPresets(normalizeSettings(settings).staticHighlighter), false);
});

void test("export/import retains shortcode mode, visibility, group state and installation history", () => {
  const settings = preset();
  const config = settings.staticHighlighter;
  config.groups![config.groupOrder![0]].enabled = false;
  config.queries[config.queryOrder[0]].hideText = false;
  const parsed = parseSettingsImport(JSON.parse(ExportModal.serialize(config.queries, settings)) as unknown);
  assert.deepEqual(parsed.errors, []);
  assert.ok(parsed.value);
  const restored = applySettingsImport(parsed.value, normalizeSettings(undefined), "replace");
  assert.deepEqual(restored.staticHighlighter, config);
  assert.equal(installDefaultPresets(restored.staticHighlighter), false);
  const empty = parseSettingsImport({});
  assert.ok(empty.value);
  const replaced = applySettingsImport(empty.value, settings, "replace");
  assert.equal(installDefaultPresets(replaced.staticHighlighter), false);
  assert.deepEqual(replaced.staticHighlighter.queryOrder, []);
});

void test("invalid preset history and malformed shortcode modes are rejected on import", () => {
  assert.ok(parseSettingsImport({ queries: {}, installedPresets: [1] }).errors.length);
  assert.ok(parseSettingsImport({ rule: { query: ":smile:", queryMode: "emoji-shortcodes", regex: true } }).errors.length);
});
