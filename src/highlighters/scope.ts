import { lineClassNodeProp, syntaxTree, tokenClassNodeProp } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import * as obsidian from "obsidian";

export const EDITOR_SCOPE_CLASS = "keyword-decorator-editor-scope";
export const EDITOR_BODY_SELECTOR = `.${EDITOR_SCOPE_CLASS} .cm-content`;
export const READING_BODY_SELECTOR =
  '.workspace-leaf-content[data-type="markdown"] .markdown-reading-view .markdown-preview-view';

export const READING_EXCLUDED_SELECTOR = [
  "a", "code", "pre", "script", "style", "textarea", "input", "button", "select", "svg", "math",
  ".math", ".frontmatter", ".frontmatter-container", ".metadata-container", ".tag",
  ".internal-embed", ".markdown-embed", ".image-embed", ".footnote-ref", ".footnote-backref",
  ".modal", ".suggestion-container", ".popover", ".hover-popover",
  ".embedded-backlinks", ".backlink-pane", ".search-results-container", ".search-result",
  ".keyword-decorator-reading-mark", ".keyword-decorator-reading-line", ".keyword-decorator-prefix", ".cm-content",
  '[contenteditable="true"]',
].join(", ");

export function canDecorateEditor(state: EditorState, decorateInSourceMode: boolean): boolean {
  // Other plugins can also host CodeMirror editors (for example in a dialog).
  // Only a Markdown file view is a note body.
  return state.field(obsidian.editorInfoField, false) instanceof obsidian.MarkdownView &&
    (state.field(obsidian.editorLivePreviewField, false) === true || decorateInSourceMode === true);
}

export function isReadingBody(element: HTMLElement): boolean {
  return !!element.closest(READING_BODY_SELECTOR) && !element.closest(READING_EXCLUDED_SELECTOR);
}

export function isReadingText(element: HTMLElement): boolean {
  return !element.closest(READING_EXCLUDED_SELECTOR);
}

export interface ExcludedRange {
  from: number;
  to: number;
}

const excludedToken = /^(?:link|url|image|formatting|inline-code|code|comment|math|hashtag|tag|attribute|string|meta|footref|hmd-(?:barelink\d*|internal-link|embed|frontmatter|codeblock|indented-code|math|footnote|footref\d*|blockid|html|cdata))(?:-|$)/;
const excludedLine = /^(?:HyperMD-(?:codeblock|frontmatter|footnote)|hmd-(?:codeblock|frontmatter))(?:-|$)/;

export function excludedEditorRanges(state: EditorState, from: number, to: number): ExcludedRange[] {
  const ranges: ExcludedRange[] = [];
  const tree = syntaxTree(state);
  // Never decorate text whose Markdown context has not been parsed yet.
  if (tree.length < to) ranges.push({ from: tree.length, to });
  tree.iterate({
    from,
    to,
    enter(node) {
      const tokens = node.type.prop(tokenClassNodeProp)?.split(" ") || [];
      const lines = node.type.prop(lineClassNodeProp)?.split(" ") || [];
      if (lines.some(token => excludedLine.test(token))) {
        const first = state.doc.lineAt(node.from);
        const last = state.doc.lineAt(Math.max(node.from, node.to - 1));
        ranges.push({ from: first.from, to: last.to });
        return false;
      }
      if (tokens.some(token => excludedToken.test(token))) {
        ranges.push({ from: node.from, to: node.to });
        return false;
      }
    },
  });
  return ranges.sort((a, b) => a.from - b.from);
}

export function overlapsExcludedRange(ranges: ExcludedRange[], from: number, to: number): boolean {
  for (const range of ranges) {
    if (range.from >= to) break;
    if (range.to > from) return true;
  }
  return false;
}

export function editorTextRanges(excluded: ExcludedRange[], from: number, to: number): ExcludedRange[] {
  const ranges: ExcludedRange[] = [];
  let cursor = from;
  for (const range of excluded) {
    if (range.to <= cursor) continue;
    if (range.from >= to) break;
    if (range.from > cursor) ranges.push({ from: cursor, to: Math.min(range.from, to) });
    cursor = Math.max(cursor, range.to);
  }
  if (cursor < to) ranges.push({ from: cursor, to });
  return ranges;
}
