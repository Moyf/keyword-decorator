import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { build } from "esbuild";

const require = createRequire(import.meta.url);
const { EditorState } = require("@codemirror/state");
const { Language, lineClassNodeProp, tokenClassNodeProp } = require("@codemirror/language");
const { NodeType, Tree } = require("@lezer/common");
const result = await build({
  stdin: {
    contents: 'export * from "./src/highlighters/scope"; export * from "obsidian";',
    resolveDir: process.cwd(),
  },
  bundle: true,
  write: false,
  platform: "node",
  format: "cjs",
  external: ["@codemirror/*", "@lezer/*"],
  plugins: [{
    name: "obsidian-editor-fields",
    setup(builder) {
      builder.onResolve({ filter: /^obsidian$/ }, () => ({ path: "obsidian", namespace: "test" }));
      builder.onLoad({ filter: /.*/, namespace: "test" }, () => ({ contents: `
        import { StateField } from "@codemirror/state";
        export class MarkdownView {}
        export const editorInfoField = StateField.define({ create: () => new MarkdownView(), update: v => v });
        export const editorViewField = editorInfoField;
        export const editorLivePreviewField = StateField.define({ create: () => true, update: v => v });
      ` }));
    },
  }],
});
const module = { exports: {} };
new Function("require", "module", "exports", result.outputFiles[0].text)(require, module, module.exports);
const scope = module.exports;

function stateWithTokens(doc, tokens, parsedLength = doc.length) {
  const state = EditorState.create({ doc });
  const children = tokens.map((token, id) => new Tree(NodeType.define({
    id: id + 1,
    name: `Token${id}`,
    props: [[token.line ? lineClassNodeProp : tokenClassNodeProp, token.classes]],
  }), [], [], token.to - token.from));
  const tree = new Tree(NodeType.none, children, tokens.map(token => token.from), parsedLength);
  return {
    doc: state.doc,
    field: field => field === Language.state ? { tree } : undefined,
  };
}

test("only Markdown file editors can opt into decorations", () => {
  const note = EditorState.create({ extensions: [scope.editorInfoField, scope.editorLivePreviewField] });
  assert.equal(scope.canDecorateEditor(note, false), true);
  const source = EditorState.create({ extensions: [scope.editorInfoField] });
  assert.equal(scope.canDecorateEditor(source, false), false);
  assert.equal(scope.canDecorateEditor(source, true), true);
  const dialog = EditorState.create({ extensions: [scope.editorLivePreviewField] });
  assert.equal(scope.canDecorateEditor(dialog, true), false);
  assert.equal(scope.canDecorateEditor(EditorState.create(), true), false);
});

for (const classes of [
  "link", "link strong", "url", "hmd-internal-link", "hmd-internal-link hmd-embed",
  "hmd-barelink", "hmd-barelink2", "hmd-footref2", "inline-code", "hmd-codeblock string",
  "hmd-frontmatter", "math-inline", "math-block", "comment", "hashtag meta", "hmd-blockid",
  "formatting-link", "tag", "attribute", "string",
]) {
  test(`exclude inline ${classes}, including matches crossing into it`, () => {
    const doc = "ordinary keyword protected keyword ordinary keyword";
    const from = doc.indexOf("protected");
    const to = doc.lastIndexOf(" ordinary");
    const state = stateWithTokens(doc, [{ from, to, classes }]);
    const excluded = scope.excludedEditorRanges(state, 0, doc.length);
    assert.equal(scope.overlapsExcludedRange(excluded, 9, 16), false);
    assert.equal(scope.overlapsExcludedRange(excluded, from, to), true);
    assert.equal(scope.overlapsExcludedRange(excluded, from - 3, from + 3), true);
    assert.equal(scope.overlapsExcludedRange(excluded, to - 3, to + 3), true);
    assert.equal(scope.overlapsExcludedRange(excluded, to, doc.length), false);
  });
}

test("code block line classes protect the whole line, without consuming the next line", () => {
  const doc = "keyword\n  keyword code\nkeyword";
  const from = doc.indexOf("  ");
  const to = doc.lastIndexOf("\n") + 1;
  const state = stateWithTokens(doc, [{ from, to, classes: "HyperMD-codeblock", line: true }]);
  const excluded = scope.excludedEditorRanges(state, 0, doc.length);
  assert.equal(scope.overlapsExcludedRange(excluded, from, to - 1), true);
  assert.equal(scope.overlapsExcludedRange(excluded, to, doc.length), false);
});

test("unparsed Markdown stays undecorated until its syntax tree is ready", () => {
  const doc = "keyword keyword";
  const state = stateWithTokens(doc, [], 7);
  const excluded = scope.excludedEditorRanges(state, 0, doc.length);
  assert.equal(scope.overlapsExcludedRange(excluded, 0, 7), false);
  assert.equal(scope.overlapsExcludedRange(excluded, 8, doc.length), true);
});

test("headings, emphasis and table text remain eligible", () => {
  const doc = "heading bold table";
  const state = stateWithTokens(doc, [{ from: 0, to: doc.length, classes: "header strong em" }]);
  assert.deepEqual(scope.excludedEditorRanges(state, 0, doc.length), []);
});
