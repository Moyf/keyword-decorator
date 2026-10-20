import assert from "node:assert/strict";
import test from "node:test";
import { compileRules, findMatches } from "../src/highlighters/matching";

void test("repeatable benchmark: 50 rules over 500 KB", () => {
  const queries: Record<string, { query: string; regex: boolean }> = Object.create(null) as Record<string, { query: string; regex: boolean }>;
  const order: string[] = [];
  const corpusParts: string[] = [];
  for (let index = 0; index < 50; index++) {
    const id = `rule-${index}`;
    const term = `needle-${index}`;
    queries[id] = { query: term, regex: false };
    order.push(id);
    corpusParts.push(term);
  }
  const text = `${corpusParts.join(" ")} ${"x".repeat(500_000 - corpusParts.join(" ").length - 1)}`;
  const compiled = compileRules(queries, order);
  const started = performance.now();
  let matchCount = 0;
  for (let repeat = 0; repeat < 3; repeat++) matchCount += findMatches(text, compiled).length;
  const elapsedMs = performance.now() - started;
  assert.equal(text.length, 500_000);
  assert.equal(matchCount, 150);
  process.stdout.write(`matching benchmark: 50 rules, 500 KB, 3 runs, ${elapsedMs.toFixed(1)} ms\n`);
});
