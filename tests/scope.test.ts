import assert from "node:assert/strict";
import test from "node:test";
import { EditorState, StateField } from "@codemirror/state";
import { Language, lineClassNodeProp, tokenClassNodeProp } from "@codemirror/language";
import { NodeType, Tree } from "@lezer/common";
import { editorInfoField, editorLivePreviewField } from "obsidian";
import { canDecorateEditor, editorTextRanges, excludedEditorRanges, excludedMarkdownLineRanges, overlapsExcludedRange } from "../src/highlighters/scope";
import { normalizeSettings } from "../src/settings/settings";
import { ExportModal } from "../src/settings/export";
import { applySettingsImport, parseSettingsImport } from "../src/settings/import";

function stateWithTokens(doc: string, tokens: { from: number; to: number; classes: string | number | undefined; line?: boolean }[], parsedLength = doc.length): EditorState {
  const state = EditorState.create({ doc });
  const children = tokens.map((token, id) => new Tree(NodeType.define({
    id: id + 1,
    name: `Token${id}`,
    props: [[token.line ? lineClassNodeProp : tokenClassNodeProp, token.classes]],
  }), [], [], token.to - token.from));
  const tree = new Tree(NodeType.none, children, tokens.map(token => token.from), parsedLength);
  const languageField = (Language as unknown as { state: StateField<{ tree: Tree }> }).state;
  return { doc: state.doc, field: (field: unknown) => field === languageField ? { tree } : undefined } as unknown as EditorState;
}

void test("only Markdown file editors can opt into decorations", () => {
  const note = EditorState.create({ extensions: [editorInfoField, editorLivePreviewField] });
  assert.equal(canDecorateEditor(note, false), true);
  const source = EditorState.create({ extensions: [editorInfoField] });
  assert.equal(canDecorateEditor(source, false), false);
  assert.equal(canDecorateEditor(source, true), true);
  const dialog = EditorState.create({ extensions: [editorLivePreviewField] });
  assert.equal(canDecorateEditor(dialog, true), false);
  assert.equal(canDecorateEditor(EditorState.create(), true), false);
});

for (const classes of [
  "link", "link strong", "url", "hmd-internal-link", "hmd-internal-link hmd-embed",
  "hmd-barelink", "hmd-barelink2", "hmd-footref2", "inline-code", "hmd-codeblock string",
  "hmd-frontmatter", "math-inline", "math-block", "hmd-math", "comment", "hashtag meta", "hmd-blockid",
  "formatting-link", "tag", "attribute", "string",
]) {
  void test(`exclude inline ${classes}, including matches crossing into it`, () => {
    const doc = "ordinary keyword protected keyword ordinary keyword";
    const from = doc.indexOf("protected");
    const to = doc.lastIndexOf(" ordinary");
    const state = stateWithTokens(doc, [{ from, to, classes }]);
    const excluded = excludedEditorRanges(state, 0, doc.length);
    assert.equal(overlapsExcludedRange(excluded, 9, 16), false);
    assert.equal(overlapsExcludedRange(excluded, from, to), true);
    assert.equal(overlapsExcludedRange(excluded, from - 3, from + 3), true);
    assert.equal(overlapsExcludedRange(excluded, to - 3, to + 3), true);
    assert.equal(overlapsExcludedRange(excluded, to, doc.length), false);
  });
}

void test("code block line classes protect the whole line, without consuming the next line", () => {
  const doc = "keyword\n  keyword code\nkeyword";
  const from = doc.indexOf("  ");
  const to = doc.lastIndexOf("\n") + 1;
  const state = stateWithTokens(doc, [{ from, to, classes: "HyperMD-codeblock", line: true }]);
  const excluded = excludedEditorRanges(state, 0, doc.length);
  assert.equal(overlapsExcludedRange(excluded, from, to - 1), true);
  assert.equal(overlapsExcludedRange(excluded, to, doc.length), false);
});

void test("unparsed Markdown stays undecorated until its syntax tree is ready", () => {
  const doc = "keyword keyword";
  const state = stateWithTokens(doc, [], 7);
  const excluded = excludedEditorRanges(state, 0, doc.length);
  assert.equal(overlapsExcludedRange(excluded, 0, 7), false);
  assert.equal(overlapsExcludedRange(excluded, 8, doc.length), true);
});

void test("headings, emphasis and table text remain eligible", () => {
  const doc = "heading bold table";
  const state = stateWithTokens(doc, [{ from: 0, to: doc.length, classes: "header strong em" }]);
  assert.deepEqual(excludedEditorRanges(state, 0, doc.length), []);
});

void test("missing or non-string internal class props are ignored for tokens and lines", () => {
  const doc = "ordinary keyword";
  for (const line of [false, true]) {
    for (const classes of [undefined, 42]) {
      const state = stateWithTokens(doc, [{ from: 0, to: doc.length, classes, line }]);
      assert.deepEqual(excludedEditorRanges(state, 0, doc.length), []);
    }
  }
});

void test("whole-line styles split around protected links, code and overlapping exclusions", () => {
  assert.deepEqual(editorTextRanges([{ from: 3, to: 8 }, { from: 6, to: 10 }, { from: 14, to: 20 }], 0, 18), [
    { from: 0, to: 3 }, { from: 10, to: 14 },
  ]);
  assert.deepEqual(editorTextRanges([{ from: 0, to: 20 }], 5, 15), []);
  assert.deepEqual(editorTextRanges([], 0, 18), [{ from: 0, to: 18 }]);
});

void test("source mode normalization defaults off and preserves explicit opt-in", () => {
  assert.equal(normalizeSettings(undefined).staticHighlighter.decorateInSourceMode, false);
  assert.equal(normalizeSettings({ staticHighlighter: { decorateInSourceMode: true } }).staticHighlighter.decorateInSourceMode, true);
  assert.equal(normalizeSettings({ staticHighlighter: { decorateInSourceMode: "true" } }).staticHighlighter.decorateInSourceMode, false);
});

void test("source mode opt-in survives full export and legacy rule imports", () => {
  const current = normalizeSettings({ staticHighlighter: { decorateInSourceMode: true } });
  const exported: unknown = JSON.parse(ExportModal.serialize(current.staticHighlighter.queries, current));
  const parsed = parseSettingsImport(exported);
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.value?.decorateInSourceMode, true);
  const legacy = parseSettingsImport({ keyword: { query: "keyword", regex: false } }).value;
  assert.ok(legacy);
  assert.equal(applySettingsImport(legacy, current, "replace").staticHighlighter.decorateInSourceMode, true);
  assert.equal(applySettingsImport({ ...legacy, decorateInSourceMode: false }, current, "merge").staticHighlighter.decorateInSourceMode, false);
  assert.ok(parseSettingsImport({ queries: {}, decorateInSourceMode: "true" }).errors.length);
});

void test("source and editor share CRLF frontmatter and backtick/quoted-tilde line exclusions", () => {
  const source = "\uFEFF---\r\ntitle: key\r\n---\r\nkey\r\n```md\r\nkey\r\n````\r\nkey\r\n> ~~~\r\n> key\r\n> ~~~~\r\nkey";
  const sourceRanges = excludedMarkdownLineRanges(source);
  // CodeMirror normalizes CRLF, so compare corresponding occurrences rather
  // than reusing source character offsets in the editor's normalized text.
  const editorText = source.replace(/\r\n/g, "\n");
  const editorRanges = excludedEditorRanges(stateWithTokens(editorText, [
    { from: 0, to: editorText.indexOf("\nkey\n```") + 1, classes: "HyperMD-frontmatter", line: true },
    { from: editorText.indexOf("```md"), to: editorText.indexOf("````") + 5, classes: "HyperMD-codeblock", line: true },
    { from: editorText.indexOf("> ~~~"), to: editorText.indexOf("> ~~~~") + 7, classes: "HyperMD-codeblock", line: true },
  ]), 0, editorText.length);
  const protectedMatches: boolean[] = [];
  let editorFrom = -1;
  for (let from = source.indexOf("key"); from !== -1; from = source.indexOf("key", from + 3)) {
    editorFrom = editorText.indexOf("key", editorFrom + 1);
    const excluded = overlapsExcludedRange(sourceRanges, from, from + 3);
    protectedMatches.push(excluded);
    assert.equal(overlapsExcludedRange(editorRanges, editorFrom, editorFrom + 3), excluded);
  }
  assert.deepEqual(protectedMatches, [true, false, true, false, true, false]);
});

void test("source exclusions require matching fence delimiters and protect unclosed blocks", () => {
  const source = "```txt\nkey\n~~~\nkey\n```\nkey";
  const ranges = excludedMarkdownLineRanges(source);
  assert.equal(overlapsExcludedRange(ranges, source.indexOf("key"), source.indexOf("key") + 3), true);
  assert.equal(overlapsExcludedRange(ranges, source.lastIndexOf("key"), source.length), false);
  assert.deepEqual(excludedMarkdownLineRanges("intro\n~~~\nkey"), [{ from: 6, to: 13 }]);
  assert.deepEqual(excludedMarkdownLineRanges("intro\n---\nkey"), []);
});
