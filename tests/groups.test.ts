import assert from "node:assert/strict";
import test from "node:test";
import { getEffectiveQueries, getEffectiveRule, repairGroupOrder, syncGroupedQueryOrder } from "../src/settings/groups";
import { applySettingsImport, parseSettingsImport } from "../src/settings/import";
import { ExportModal } from "../src/settings/export";
import { normalizeSettings } from "../src/settings/settings";

void test("effective rule inherits undefined appearance and respects explicit false, null, and empty overrides", () => {
  const rule = { query: "word", regex: false, groupId: "g", color: null, italic: false, prefixValue: "" };
  const groups = { g: { name: "Group", style: { color: "#123456", italic: true, underline: true, prefixValue: "✨" } } };
  const effective = getEffectiveRule(rule, groups);
  assert.equal(effective.color, null);
  assert.equal(effective.italic, false);
  assert.equal(effective.underline, true);
  assert.equal(effective.prefixValue, "");
  assert.equal(effective.iconInheritColor, true);
  assert.equal(effective.backgroundIncludesMarker, false);
  assert.equal(effective.styleWholeLine, false);
  assert.deepEqual(rule, { query: "word", regex: false, groupId: "g", color: null, italic: false, prefixValue: "" });
  assert.deepEqual(groups.g.style, { color: "#123456", italic: true, underline: true, prefixValue: "✨" });
});

void test("group and rule disabled state both disable effective queries", () => {
  const config = {
    queries: {
      enabled: { query: "one", regex: false, groupId: "active" },
      disabledRule: { query: "two", regex: false, groupId: "active", enabled: false },
      disabledGroup: { query: "three", regex: false, groupId: "off" },
    },
    queryOrder: ["enabled", "disabledRule", "disabledGroup"],
    groups: { active: { name: "Active" }, off: { name: "Off", enabled: false } },
  };
  const effective = getEffectiveQueries(config);
  assert.equal(effective.enabled.enabled, true);
  assert.equal(effective.disabledRule.enabled, false);
  assert.equal(effective.disabledGroup.enabled, false);
});

void test("group order repair and grouped query ordering preserve every rule and member order", () => {
  const config = {
    queries: {
      a: { query: "a", regex: false, groupId: "first" },
      loose1: { query: "loose1", regex: false },
      b: { query: "b", regex: false, groupId: "second" },
      c: { query: "c", regex: false, groupId: "first" },
      loose2: { query: "loose2", regex: false },
    },
    queryOrder: ["a", "loose1", "b", "c", "loose2", "missing", "a"],
    groups: { first: { name: "First" }, second: { name: "Second" } },
    groupOrder: ["second", "unknown", "second"],
  };
  assert.deepEqual(repairGroupOrder(config), ["second", "first"]);
  syncGroupedQueryOrder(config);
  assert.deepEqual(config.queryOrder, ["loose1", "loose2", "b", "a", "c"]);
});

void test("settings normalization and full export/import preserve group data and appearance caches", () => {
  const settings = normalizeSettings({
    staticHighlighter: {
      queries: {
        rule: { query: "word", regex: false, groupId: "g", iconInheritColor: false, backgroundIncludesMarker: true, styleWholeLine: true, prefixValues: { emoji: "✨", icon: "sparkles" } },
        orphan: { query: "other", regex: false, groupId: "missing" },
      },
      queryOrder: ["rule", "orphan"],
      groups: { g: { name: "Group", enabled: false, collapsed: true, style: { color: "#abc", iconInheritColor: false } } },
      groupOrder: ["g"],
    },
  });
  assert.equal(settings.staticHighlighter.queries.rule.groupId, "g");
  assert.equal(settings.staticHighlighter.queries.orphan.groupId, undefined);
  const parsed = parseSettingsImport(JSON.parse(ExportModal.serialize(settings.staticHighlighter.queries, settings)) as unknown);
  assert.deepEqual(parsed.errors, []);
  assert.ok(parsed.value);
  assert.deepEqual(parsed.value?.groups, settings.staticHighlighter.groups);
  assert.deepEqual(parsed.value?.groupOrder, ["g"]);
  assert.deepEqual(parsed.value?.queries.rule.prefixValues, { emoji: "✨", icon: "sparkles" });
  assert.equal(parsed.value?.queries.rule.iconInheritColor, false);
  const replaced = applySettingsImport(parsed.value, settings, "replace");
  assert.deepEqual(replaced.staticHighlighter.groups, settings.staticHighlighter.groups);
  assert.deepEqual(replaced.staticHighlighter.groupOrder, ["g"]);
});

void test("settings import rejects malformed group style and appearance metadata", () => {
  const parsed = parseSettingsImport({
    staticHighlighter: {
      queries: { rule: { query: "x", regex: false, groupId: "g", prefixValues: { icon: 12 } } },
      groups: { g: { name: "Group", style: { query: "forbidden", iconInheritColor: "yes" } } },
      groupOrder: ["g"],
    },
  });
  assert.equal(parsed.value, undefined);
  assert.ok(parsed.errors.some(error => error.includes("prefixValues")));
  assert.ok(parsed.errors.some(error => error.includes("style cannot contain query")));
  assert.ok(parsed.errors.some(error => error.includes("iconInheritColor")));
});

void test("merge import updates colliding group IDs so imported rules use the updated group", () => {
  const current = normalizeSettings({
    staticHighlighter: {
      queries: { existing: { query: "old", regex: false, groupId: "shared" } },
      queryOrder: ["existing"],
      groups: { shared: { name: "Old", style: { color: "#111" } } },
      groupOrder: ["shared"],
    },
  });
  const incoming = parseSettingsImport({
    staticHighlighter: {
      queries: { imported: { query: "new", regex: false, groupId: "shared" } },
      queryOrder: ["imported"],
      groups: { shared: { name: "Updated", style: { color: "#222" } } },
      groupOrder: ["shared"],
    },
  });
  assert.deepEqual(incoming.errors, []);
  const merged = applySettingsImport(incoming.value!, current, "merge");
  assert.equal(merged.staticHighlighter.groups?.shared.name, "Updated");
  assert.equal(merged.staticHighlighter.queries.imported.groupId, "shared");
  assert.equal(merged.staticHighlighter.queries.existing.groupId, "shared");
  assert.equal(getEffectiveRule(merged.staticHighlighter.queries.existing, merged.staticHighlighter.groups).color, "#222");
});
