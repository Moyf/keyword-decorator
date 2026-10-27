import assert from "node:assert/strict";
import test from "node:test";
import { App, MarkdownPostProcessorContext, TFile } from "obsidian";
import DynamicHighlightsPlugin from "../src/main";
import { normalizeSettings, SearchQueries } from "../src/settings/settings";
import { createTestDocument } from "./dom-fixture";

function readingFixture(source: string, queries: SearchQueries) {
  const { document } = createTestDocument();
  document.body.innerHTML = '<div class="workspace-leaf-content" data-type="markdown"><div class="markdown-reading-view"><div class="markdown-preview-view"></div></div></div>';
  const preview = document.querySelector<HTMLElement>(".markdown-preview-view")!;
  const file = Object.assign(new TFile(), { path: "synthetic.md", stat: { mtime: 1 } });
  let reads = 0;
  const app = { vault: {
    getAbstractFileByPath: () => file,
    cachedRead: () => { reads++; return Promise.resolve(source); },
  } } as unknown as App;
  const plugin = new DynamicHighlightsPlugin(app, { id: "test", name: "Test", version: "0", minAppVersion: "1.13", author: "Test", description: "Test" });
  plugin.settings = normalizeSettings({ staticHighlighter: { queries, queryOrder: Object.keys(queries) } });
  return {
    async section(text: string | string[], lineStart: number | null) {
      const root = preview.createDiv();
      for (const paragraph of typeof text === "string" ? [text] : text) root.createEl("p", { text: paragraph });
      const ctx: MarkdownPostProcessorContext = {
        docId: "synthetic",
        frontmatter: null,
        addChild: () => {},
        sourcePath: file.path,
        getSectionInfo: () => lineStart === null ? null : { lineStart, lineEnd: lineStart, text: source },
      };
      plugin.decorateReadingView(root, ctx);
      // Exercise the actual asynchronous vault read -> cache -> DOM re-entry.
      await new Promise<void>(resolve => setImmediate(resolve));
      return root;
    },
    reads: () => reads,
  };
}

void test("reading once integrates frontmatter, a second section and distinct per-text ordinals", async () => {
  const source = "---\ntitle: 博士\n---\n\nintro\n\n博士与凯尔希\n\n博士与凯尔希";
  const fixture = readingFixture(source, {
    doctor: { query: "博士", regex: false, decorateOnce: true },
    kelsi: { query: "凯尔希", regex: false, decorateOnce: true },
  });
  const first = await fixture.section("intro", 4);
  const second = await fixture.section("博士与凯尔希", 6);
  const third = await fixture.section("博士与凯尔希", 8);
  assert.equal(first.querySelectorAll(".keyword-decorator-reading-mark").length, 0);
  assert.equal(second.querySelectorAll(".kd-rule-doctor").length, 1);
  assert.equal(second.querySelectorAll(".kd-rule-kelsi").length, 1);
  assert.equal(third.querySelectorAll(".keyword-decorator-reading-mark").length, 0);
  assert.equal(fixture.reads(), 1);
});

void test("reading once skips fenced code and frontmatter when selecting the first visible term", async () => {
  const source = "---\ntitle: alpha\n---\n```txt\nalpha\n```\n~~~\nalpha\n~~~\nbeta alpha\nbeta alpha";
  const fixture = readingFixture(source, { pair: { query: "alpha\nbeta", queryMode: "keywords", regex: false, decorateOnce: true } });
  const body = await fixture.section("beta alpha", 9);
  assert.deepEqual(Array.from(body.querySelectorAll(".kd-rule-pair"), mark => mark.textContent), ["beta"]);
  const later = await fixture.section("beta alpha", 10);
  assert.equal(later.querySelectorAll(".kd-rule-pair").length, 0);
});

void test("unknown and out-of-range section lines keep all reading decorations visible", async () => {
  for (const line of [null, -1, 100, 1.5, Number.NaN]) {
    const fixture = readingFixture("博士 博士", { doctor: { query: "博士", regex: false, decorateOnce: true } });
    const root = await fixture.section("博士 博士", line);
    assert.equal(root.querySelectorAll(".kd-rule-doctor").length, 2, `line ${line}`);
  }
});

void test("ordinary source matches cannot starve a later reading once rule", async () => {
  const source = "noise ".repeat(1100) + "\n博士 博士";
  const queries: SearchQueries = {};
  for (let index = 0; index < 5; index++) queries[`noise-${index}`] = { query: "noise", regex: false };
  queries.doctor = { query: "博士", regex: false, decorateOnce: true };
  const fixture = readingFixture(source, queries);
  const root = await fixture.section("博士 博士", 1);
  assert.equal(root.querySelectorAll(".kd-rule-doctor").length, 1);
});

void test("a rule with no reliable target falls back to decorating every visible occurrence", async () => {
  const source = "```\n" + "博士\n".repeat(1001) + "```\n博士 博士";
  const fixture = readingFixture(source, { doctor: { query: "博士", regex: false, decorateOnce: true } });
  const root = await fixture.section("博士 博士", 1003);
  assert.equal(root.querySelectorAll(".kd-rule-doctor").length, 2);
});

void test("once targets are not repeated across multiple blocks in the same rendered section", async () => {
  const fixture = readingFixture("博士\n\n博士", { doctor: { query: "博士", regex: false, decorateOnce: true } });
  const root = await fixture.section(["博士", "博士"], 0);
  assert.equal(root.querySelectorAll(".kd-rule-doctor").length, 1);
});
