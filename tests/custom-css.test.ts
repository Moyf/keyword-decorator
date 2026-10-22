import assert from "node:assert/strict";
import test from "node:test";
import { scopeSelector } from "../src/highlighters/custom-css";

void test("custom CSS retains theme and editor ancestors", () => {
  for (const selector of [".theme-dark .kd-rule-test", ".markdown-source-view .kd-rule-test", ".markdown-preview-view .kd-rule-test:hover"]) {
    const scoped = scopeSelector(selector);
    assert.ok(scoped.startsWith(selector + ":where("));
    assert.ok(scoped.includes(".keyword-decorator-editor-scope .cm-content"));
    assert.ok(scoped.includes('.workspace-leaf-content[data-type="markdown"]'));
  }
});

void test("custom CSS puts body constraints before standard and legacy pseudo-elements", () => {
  for (const pseudo of ["::before", "::after", ":before", ":after", "::first-line", ":first-letter"]) {
    const scoped = scopeSelector(".theme-dark .kd-rule-test:hover" + pseudo);
    assert.ok(scoped.startsWith(".theme-dark .kd-rule-test:hover:where("));
    assert.ok(scoped.endsWith(pseudo));
  }
});

void test("quoted and functional selector text does not look like a pseudo-element", () => {
  for (const selector of ['[data-label="::before"] .rule', ':is(.rule, [data-label="::after"]):hover', '.rule\\:\\:before']) {
    assert.ok(scopeSelector(selector).startsWith(selector + ":where("));
  }
});
