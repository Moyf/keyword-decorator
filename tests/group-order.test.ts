import assert from "node:assert/strict";
import test from "node:test";
import { moveRuleGroup, moveRuleToGroup, moveRulesToGroup } from "../src/settings/group-order";
import type { StaticHighlightOptions } from "../src/settings/settings";

function makeConfig(): StaticHighlightOptions {
  return {
    queries: {
      a: { query: "a", regex: false, groupId: "one", color: "#abc", enabled: false },
      b: { query: "b", regex: false, groupId: "two", italic: true },
      c: { query: "c", regex: false, groupId: "one", prefixValues: { emoji: "✨" } },
      d: { query: "d", regex: false, groupId: "two", backgroundIncludesMarker: true },
      loose: { query: "loose", regex: false, styleWholeLine: true },
    },
    queryOrder: ["loose", "a", "c", "b", "d"],
    groups: { one: { name: "One" }, two: { name: "Two" }, empty: { name: "Empty" } },
    groupOrder: ["one", "two", "empty"],
  };
}

void test("moveRuleToGroup inserts before a target member and preserves all other member order and appearance", () => {
  const config = makeConfig();
  const movedRuleBefore = structuredClone(config.queries.c);
  assert.equal(moveRuleToGroup(config, "c", "two", "d"), true);
  assert.equal(config.queries.c.groupId, "two");
  assert.deepEqual(config.queryOrder, ["loose", "a", "b", "c", "d"]);
  assert.deepEqual(config.queries.c, { ...movedRuleBefore, groupId: "two" });
  assert.deepEqual(config.queryOrder.filter(id => config.queries[id].groupId === "two"), ["b", "c", "d"]);
});

void test("moveRuleToGroup appends to the target group when no valid before member is supplied", () => {
  const config = makeConfig();
  assert.equal(moveRuleToGroup(config, "a", "two", "loose"), true);
  assert.equal(config.queries.a.groupId, "two");
  assert.deepEqual(config.queryOrder, ["loose", "c", "b", "d", "a"]);
  assert.deepEqual(config.queryOrder.filter(id => config.queries[id].groupId === "two"), ["b", "d", "a"]);
});

void test("moveRuleToGroup ungroups a rule and appends it among ungrouped rules", () => {
  const config = makeConfig();
  assert.equal(moveRuleToGroup(config, "a", "missing"), true);
  assert.equal(Object.prototype.hasOwnProperty.call(config.queries.a, "groupId"), false);
  assert.deepEqual(config.queryOrder, ["loose", "a", "c", "b", "d"]);
  assert.equal(config.queries.a.enabled, false);
  assert.equal(config.queries.a.color, "#abc");
});

void test("moveRuleToGroup supports explicit ungrouped placement before another ungrouped rule", () => {
  const config = makeConfig();
  assert.equal(moveRuleToGroup(config, "a", undefined, "loose"), true);
  assert.deepEqual(config.queryOrder, ["a", "loose", "c", "b", "d"]);
});

void test("moving rules to their current position and invalid rule IDs are no-ops", () => {
  const config = makeConfig();
  const original = structuredClone(config);
  assert.equal(moveRuleToGroup(config, "a", "one", "c"), false);
  assert.equal(moveRuleToGroup(config, "missing", "two"), false);
  assert.deepEqual(config, original);
});

void test("moveRuleGroup places a group before another and moves its entire rule block", () => {
  const config = makeConfig();
  assert.equal(moveRuleGroup(config, "two", "one"), true);
  assert.deepEqual(config.groupOrder, ["two", "one", "empty"]);
  assert.deepEqual(config.queryOrder, ["loose", "b", "d", "a", "c"]);
});

void test("moveRuleGroup appends on invalid targets and reports no-op when already last", () => {
  const config = makeConfig();
  assert.equal(moveRuleGroup(config, "one", "missing"), true);
  assert.deepEqual(config.groupOrder, ["two", "empty", "one"]);
  assert.equal(moveRuleGroup(config, "one"), false);
  assert.equal(moveRuleGroup(config, "missing"), false);
});

void test("moving a group repairs malformed group order without losing any groups or rules", () => {
  const config = makeConfig();
  config.groupOrder = ["two", "two", "stale"];
  assert.equal(moveRuleGroup(config, "one", "two"), true);
  assert.deepEqual(config.groupOrder, ["one", "two", "empty"]);
  assert.deepEqual(new Set(config.queryOrder), new Set(Object.keys(config.queries)));
  assert.deepEqual(config.queries.c.prefixValues, { emoji: "✨" });
  assert.equal(config.queries.d.backgroundIncludesMarker, true);
});

void test("multi-rule moves keep list order across groups and preserve explicit rule appearance", () => {
  const config = makeConfig();
  const original = structuredClone(config.queries);
  assert.equal(moveRulesToGroup(config, ["b", "a", "a", "missing"], "two", "d"), true);
  assert.deepEqual(config.queryOrder, ["loose", "c", "a", "b", "d"]);
  assert.deepEqual(config.queries.a, { ...original.a, groupId: "two" });
  assert.deepEqual(config.queries.b, original.b);
  assert.deepEqual(config.queries.c, original.c);
});

void test("multi-rule moves support empty groups and ungrouping the whole block", () => {
  const config = makeConfig();
  assert.equal(moveRulesToGroup(config, ["c", "a"], "empty"), true);
  assert.deepEqual(config.queryOrder, ["loose", "b", "d", "a", "c"]);
  assert.equal(config.queries.a.groupId, "empty");
  assert.equal(config.queries.c.groupId, "empty");
  assert.equal(moveRulesToGroup(config, ["c", "a"], undefined, "loose"), true);
  assert.deepEqual(config.queryOrder, ["a", "c", "loose", "b", "d"]);
  assert.equal(config.queries.a.groupId, undefined);
  assert.equal(config.queries.c.groupId, undefined);
});

void test("dropping onto the selection, an unchanged block or missing rules is a no-op", () => {
  const config = makeConfig(), original = structuredClone(config);
  assert.equal(moveRulesToGroup(config, ["a", "c"], "one"), false);
  assert.equal(moveRulesToGroup(config, ["a", "c"], "two", "c"), false);
  assert.equal(moveRulesToGroup(config, ["missing"], "two"), false);
  assert.equal(moveRulesToGroup(config, [], "two"), false);
  assert.deepEqual(config, original);
});

void test("filtered nonadjacent selections keep unselected rules in their original relative order", () => {
  const config = makeConfig();
  assert.equal(moveRulesToGroup(config, ["a", "d"], "one", "c"), true);
  assert.deepEqual(config.queryOrder, ["loose", "a", "d", "c", "b"]);
  assert.deepEqual(config.queryOrder.filter(id => !["a", "d"].includes(id)), ["loose", "c", "b"]);
});
