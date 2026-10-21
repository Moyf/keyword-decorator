import assert from "node:assert/strict";
import test from "node:test";
import { appendBulkRules, parseBulkRules } from "../src/settings/bulk";
import { applySettingsImport, parseSettingsImport } from "../src/settings/import";
import { ExportModal } from "../src/settings/export";
import { normalizeSettings } from "../src/settings/settings";

void test("network image rules retain the URL and query string through export/import", () => {
  const url = "https://media.prts.wiki/image.png?v=example-cache-version";
  const settings = normalizeSettings({staticHighlighter:{queries:{remote:{query:"portrait",regex:false,prefixType:"url",prefixValue:url,imageWidth:48,imageHeight:48,hideText:true}},queryOrder:["remote"]}});
  const parsed = parseSettingsImport(JSON.parse(ExportModal.serialize(settings.staticHighlighter.queries, settings)) as unknown);
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.value?.queries.remote.prefixType, "url");
  assert.equal(parsed.value?.queries.remote.prefixValue, url);
  assert.equal(parsed.value?.queries.remote.hideText, true);
});

void test("bulk image URLs become network image rules", () => {
  const url = "https://example.com/portrait.png?version=2";
  const result = parseBulkRules(`Portrait\tkeyword\t${url}`);
  assert.deepEqual(result.errors, []);
  assert.equal(result.rules[result.queryOrder[0]].prefixType, "url");
  assert.equal(result.rules[result.queryOrder[0]].prefixValue, url);
});
import type { SearchQueries } from "../src/settings/settings";

void test("normalizeSettings repairs missing fields and order while preserving invalid regex text", () => {
  const rawQueries: unknown = JSON.parse(JSON.stringify({
    alpha: { query: "alpha", regex: false, css: ".alpha {}", mark: ["match"] },
    broken: { query: "[", regex: true, queryMode: "regex", imageWidth: 900 },
  }));
  const settings = normalizeSettings({
    selectionHighlighter: { highlightSelectedText: false, ignoredWords: "one,two", customSetting: 7 },
    staticHighlighter: {
      queries: rawQueries,
      queryOrder: ["orphan", "alpha", "alpha"],
    },
  });
  assert.equal(settings.enabled, true);
  assert.equal(settings.selectionHighlighter.highlightSelectedText, false);
  assert.equal((settings.selectionHighlighter as typeof settings.selectionHighlighter & { customSetting: number }).customSetting, 7);
  assert.deepEqual(settings.staticHighlighter.queryOrder, ["alpha", "broken"]);
  assert.equal(settings.staticHighlighter.queries.broken.query, "[");
  assert.equal(settings.staticHighlighter.queries.broken.regex, true);
  assert.equal(settings.staticHighlighter.queries.broken.imageWidth, undefined);
  assert.equal(settings.staticHighlighter.queries.alpha.css, ".alpha {}");
  assert.deepEqual(settings.staticHighlighter.queries.alpha.mark, ["match"]);
  assert.equal(settings.staticHighlighter.queries.alpha.hideText, undefined);
  assert.equal(settings.staticHighlighter.queries.alpha.imageHeight, undefined);
});

void test("normalizeSettings drops a prototype-pollution rule id", () => {
  const raw: unknown = JSON.parse('{"staticHighlighter":{"queries":{"__proto__":{"query":"x","regex":false},"safe":{"query":"safe","regex":false}}}}') as unknown;
  const settings = normalizeSettings(raw);
  assert.deepEqual(Object.keys(settings.staticHighlighter.queries), ["safe"]);
});

void test("parseSettingsImport rejects invalid regex and inconsistent query mode before returning data", () => {
  const result = parseSettingsImport({
    invalid: { query: "[", regex: true, queryMode: "regex" },
    mismatch: { query: "word", regex: true, queryMode: "single" },
  });
  assert.equal(result.value, undefined);
  assert.equal(result.errors.length, 2);
});

void test("parseSettingsImport preserves exported order and accepts svg and bounded dimensions", () => {
  const result = parseSettingsImport({
    enabled: false,
    staticHighlighter: {
      queryOrder: ["second", "first"],
      queries: {
        first: { query: "one", regex: false, prefixType: "svg", imageWidth: 512 },
        second: { query: "two", regex: false },
      },
    },
  });
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.value?.queryOrder, ["second", "first"]);
  assert.equal(result.value?.enabled, false);
  assert.equal(result.value?.queries.first.prefixType, "svg");
});

void test("bulk plain text creates new enabled single-query rules without inheriting template labels or mode", () => {
  const parsed = parseBulkRules("one\ntwo", {
    query: "template",
    regex: true,
    queryMode: "regex",
    name: "Template label",
    enabled: false,
    color: "#123456",
  });
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.queryOrder.length, 2);
  for (const id of parsed.queryOrder) {
    const rule = parsed.rules[id];
    assert.equal(rule.enabled, true);
    assert.equal(rule.queryMode, "keywords");
    assert.equal(rule.regex, false);
    assert.equal(rule.name, rule.query);
    assert.equal(rule.color, undefined);
  }
});

void test("bulk TSV parses name, keyword, image and optional appearance inheritance", () => {
  const template = { query: "template", regex: false, color: "#123456", css: ".rule {}" };
  const plain = parseBulkRules("Label\tkeyword\timage.svg", template);
  const inherited = parseBulkRules("Label\tkeyword\timage.svg", template, [], true);
  assert.deepEqual(plain.errors, []);
  assert.deepEqual(inherited.errors, []);
  const plainRule = plain.rules[plain.queryOrder[0]];
  const inheritedRule = inherited.rules[inherited.queryOrder[0]];
  assert.equal(plainRule.prefixType, "image");
  assert.equal(plainRule.prefixValue, "image.svg");
  assert.equal(plainRule.color, undefined);
  assert.equal(inheritedRule.color, "#123456");
  assert.equal(inheritedRule.css, ".rule {}");
});

void test("bulk JSON export keeps query order and generates collision-free ids", () => {
  const parsed = parseBulkRules(JSON.stringify({
    queryOrder: ["b", "a"],
    queries: {
      a: { query: "alpha", regex: false },
      b: { query: "beta", regex: false },
    },
  }), undefined, ["rule-collision"]);
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.queryOrder.length, 2);
  assert.equal(parsed.rules[parsed.queryOrder[0]].query, "beta");
  assert.equal(parsed.rules[parsed.queryOrder[1]].query, "alpha");
  assert.equal(new Set([...parsed.queryOrder, "rule-collision"]).size, 3);
});

void test("appendBulkRules appends rules and remaps collisions without replacing existing rules", () => {
  const current = normalizeSettings({
    staticHighlighter: {
      queries: { same: { query: "original", regex: false } },
      queryOrder: ["same"],
    },
  });
  const added = Object.create(null) as SearchQueries;
  added.same = { query: "new", regex: false };
  const result = appendBulkRules(current, added, ["same"]);
  assert.equal(result.staticHighlighter.queries.same.query, "original");
  assert.equal(result.staticHighlighter.queryOrder.length, 2);
  assert.notEqual(result.staticHighlighter.queryOrder[1], "same");
  assert.equal(result.staticHighlighter.queries[result.staticHighlighter.queryOrder[1]].query, "new");
});

void test("bulk JSON group metadata survives remapping and keeps rule references valid", () => {
  const current = normalizeSettings({
    staticHighlighter: {
      queries: { existing: { query: "old", regex: false, groupId: "shared" } },
      queryOrder: ["existing"],
      groups: { shared: { name: "Current" } },
      groupOrder: ["shared"],
    },
  });
  const parsed = parseBulkRules(JSON.stringify({
    staticHighlighter: {
      queries: { incoming: { query: "new", regex: false, groupId: "shared" } },
      queryOrder: ["incoming"],
      groups: { shared: { name: "Imported", style: { color: "#123456" } } },
      groupOrder: ["shared"],
    },
  }), undefined, Object.keys(current.staticHighlighter.queries), false, Object.keys(current.staticHighlighter.groups ?? {}));
  assert.deepEqual(parsed.errors, []);
  const result = appendBulkRules(current, parsed.rules, parsed.queryOrder, parsed.groups, parsed.groupOrder);
  const addedId = result.staticHighlighter.queryOrder[1];
  const addedGroupId = result.staticHighlighter.queries[addedId].groupId;
  assert.ok(addedGroupId);
  assert.notEqual(addedGroupId, "shared");
  assert.equal(result.staticHighlighter.groups?.shared.name, "Current");
  assert.equal(result.staticHighlighter.groups?.[addedGroupId].name, "Imported");
  assert.equal(result.staticHighlighter.queries[addedId].groupId, addedGroupId);
});

void test("settings import merges in order and permits explicit empty replacement", () => {
  const current = normalizeSettings({
    staticHighlighter: {
      queries: { existing: { query: "old", regex: false } },
      queryOrder: ["existing"],
    },
  });
  const incoming = { queries: { added: { query: "new", regex: false } }, queryOrder: ["added"], enabled: false };
  const merged = applySettingsImport(incoming, current, "merge");
  assert.deepEqual(merged.staticHighlighter.queryOrder, ["existing", "added"]);
  assert.equal(merged.enabled, false);
  const emptied = applySettingsImport({ queries: Object.create(null) as SearchQueries, queryOrder: [], enabled: true }, current, "replace");
  assert.deepEqual(emptied.staticHighlighter.queryOrder, []);
  assert.deepEqual(Object.keys(emptied.staticHighlighter.queries), []);
});

void test("export keeps the legacy rule map unless full settings metadata is requested", () => {
  const settings = normalizeSettings({
    enabled: false,
    staticHighlighter: {
      queries: { a: { query: "alpha", regex: false }, b: { query: "beta", regex: false } },
      queryOrder: ["b", "a"],
    },
  });
  const legacy = JSON.parse(ExportModal.serialize(settings.staticHighlighter.queries)) as { a: { query: string }; staticHighlighter?: unknown };
  assert.equal(legacy.a.query, "alpha");
  assert.equal(legacy.staticHighlighter, undefined);
  const full = JSON.parse(ExportModal.serialize(settings.staticHighlighter.queries, settings)) as { enabled: boolean; staticHighlighter: { queryOrder: string[] } };
  assert.equal(full.enabled, false);
  assert.deepEqual(full.staticHighlighter.queryOrder, ["b", "a"]);
});
