import { combineConfig, Extension, Facet, Range, StateEffect, Text } from "@codemirror/state";
import { syntaxTree, tokenClassNodeProp } from "@codemirror/language";
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate, WidgetType } from "@codemirror/view";
import { App } from "obsidian";
import { createPrefixNode, isImageSourceFailed, isSvgMarkupValid, resolveImage } from "../markers";
import { compileRules, CompiledRule, findMatchesInRanges } from "./matching";
import { SearchQueries } from "../settings/settings";
import { getEffectiveQueries } from "../settings/groups";
import DynamicHighlightsPlugin from "src/main";

export type StaticHighlightOptions = { queries: SearchQueries; queryOrder: string[]; enabled?: boolean };
const defaultOptions: StaticHighlightOptions = { queries: {}, queryOrder: [], enabled: true };
let runtimeApp: App | null = null;
const refreshDecorations = StateEffect.define<null>();

export const staticHighlightConfig = Facet.define<StaticHighlightOptions, Required<StaticHighlightOptions>>({
  combine(options: readonly StaticHighlightOptions[]) {
    return combineConfig(options, defaultOptions, {
      queries: (a, b) => a || b,
      queryOrder: (a, b) => a || b,
    });
  },
});

export function staticHighlighterExtension(plugin: DynamicHighlightsPlugin): Extension {
  runtimeApp = plugin.app;
  const config = plugin.settings.staticHighlighter;
  return [staticHighlighter, staticHighlightConfig.of({ ...structuredClone(config), queries: getEffectiveQueries(config), enabled: plugin.settings.enabled })];
}

export interface Styles { [selector: string]: Record<string, string> }

export function buildStyles(plugin: DynamicHighlightsPlugin): Extension {
  const styles: Styles = {};
  if (!plugin.settings.enabled) return EditorView.theme(styles);
  const queries = getEffectiveQueries(plugin.settings.staticHighlighter);
  for (const [ruleId, query] of Object.entries(queries)) {
    if (query.enabled === false) continue;
    const selector = `.${toInternalClassName(ruleId)}`;
    const style: Record<string, string> = {};
    if (query.color) style.backgroundColor = query.color;
    if (query.textColor) style.color = query.textColor;
    if (query.fontWeight) style.fontWeight = query.fontWeight;
    const cssProps: Record<string, string> = {};
    if (query.italic) cssProps["font-style"] = "italic";
    if (query.underline) cssProps["text-decoration"] = "underline";
    if (Object.keys(cssProps).length) Object.assign(style, cssProps);
    if (Object.keys(style).length) styles[selector] = style;
    if (query.styleWholeLine && Object.keys(style).length) styles[`.cm-line${selector}`] = style;
  }
  return EditorView.theme(styles);
}

function toInternalClassName(ruleId: string): string {
  return `kd-rule-${ruleId}`.replace(/[^a-zA-Z0-9_-]/g, "-");
}

const staticHighlighter = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    widgetDecorations: DecorationSet;
    private compiled: CompiledRule[] = [];
    private config: StaticHighlightOptions;
    private recomputeTimer: number | null = null;
    private readonly debounceMs = 90;
    private lastDocument: Text | null = null;
    private documentText = "";

    constructor(private readonly view: EditorView) {
      this.config = view.state.facet(staticHighlightConfig);
      this.compiled = compileRules(this.config.queries, this.config.queryOrder);
      ({ token: this.decorations, widget: this.widgetDecorations } = this.getDeco(view));
    }

    update(update: ViewUpdate) {
      const config = update.state.facet(staticHighlightConfig);
      const reconfigured = config !== this.config || update.startState.facet(staticHighlightConfig) !== config;
      const forced = update.transactions.some(transaction => transaction.effects.some(effect => effect.is(refreshDecorations)));
      if (reconfigured) {
        this.config = config;
        this.compiled = compileRules(config.queries, config.queryOrder);
      }
      if (update.docChanged) {
        // Keep old ranges valid while the new document is debounced.
        this.decorations = this.decorations.map(update.changes);
        this.widgetDecorations = this.widgetDecorations.map(update.changes);
      }
      if (update.docChanged) {
        this.scheduleRecompute(update.view);
      } else if (forced || reconfigured || update.viewportChanged || (update.selectionSet && this.compiled.some(item => item.rule.hideText))) {
        this.clearTimer();
        ({ token: this.decorations, widget: this.widgetDecorations } = this.getDeco(update.view));
      }
    }

    destroy() { this.clearTimer(); }

    private scheduleRecompute(view: EditorView) {
      this.clearTimer();
      this.recomputeTimer = window.setTimeout(() => {
        this.recomputeTimer = null;
        if (view !== this.view) return;
        ({ token: this.decorations, widget: this.widgetDecorations } = this.getDeco(view));
        view.dispatch({});
      }, this.debounceMs);
    }

    private clearTimer() {
      if (this.recomputeTimer !== null) window.clearTimeout(this.recomputeTimer);
      this.recomputeTimer = null;
    }

    private getDeco(view: EditorView): { token: DecorationSet; widget: DecorationSet } {
      const tokenDecos: Range<Decoration>[] = [];
      const widgetDecos: Range<Decoration>[] = [];
      const lineRules = new Map<number, { priority: number; ruleId: string; rule: SearchQueries[string] }>();
      if (!this.config.enabled || !this.compiled.length) return { token: Decoration.none, widget: Decoration.none };
      const state = view.state;
      const tree = syntaxTree(state);
      const visibleRanges = view.visibleRanges.filter(range => range.to > range.from);
      if (this.lastDocument !== state.doc) {
        this.lastDocument = state.doc;
        this.documentText = state.doc.toString();
      }
      const text = this.documentText;
      for (const match of findMatchesInRanges(text, visibleRanges, this.compiled)) {
        const from = match.from;
        const to = match.to;
        const startLine = state.doc.lineAt(from);
        const endLine = state.doc.lineAt(Math.max(from, to - 1));
        const syntaxNode = tree.resolveInner(Math.min(startLine.from + 1, state.doc.length));
        const nodeProps = syntaxNode.type.prop(tokenClassNodeProp)?.split(" ") || [];
        if (nodeProps.some(token => token === "hmd-codeblock" || token === "hmd-frontmatter")) continue;
        const rule = match.rule as SearchQueries[string];
        const classes = [toInternalClassName(match.ruleId), ...(rule.class || "").split(/\s+/).filter(Boolean)];
        if (rule.styleWholeLine) {
          for (let lineNumber = startLine.number; lineNumber <= endLine.number; lineNumber++) {
            const current = lineRules.get(lineNumber);
            if (!current || match.priority < current.priority) {
              lineRules.set(lineNumber, { priority: match.priority, ruleId: match.ruleId, rule });
            }
          }
        }
        const sameLine = startLine.number === endLine.number;
        const prefixValue = rule.prefixValue ?? rule.prefixValues?.[rule.prefixType || "none"] ?? "";
        const hasImageMarker = (rule.prefixType === "image" || rule.prefixType === "url") && !!runtimeApp && !!resolveImage(runtimeApp, prefixValue) && !isImageSourceFailed(runtimeApp, prefixValue);
        const hasSvgMarker = sameLine && rule.prefixType === "svg" && isSvgMarkupValid(view.dom.ownerDocument, prefixValue);
        const selectionOverlaps = rule.hideText && state.selection.ranges.some(selection =>
          selection.empty ? selection.head >= from && selection.head <= to : selection.from < to && selection.to > from
        );
        if (rule.hideText && sameLine && (hasImageMarker || hasSvgMarker) && !selectionOverlaps) classes.push("keyword-decorator-hide-text");
        if (!rule.styleWholeLine) {
          tokenDecos.push(Decoration.mark({ class: classes.join(" "), attributes: { "data-contents": state.sliceDoc(from, to) } }).range(from, to));
        } else if (rule.hideText) {
          tokenDecos.push(Decoration.mark({ class: "keyword-decorator-hide-text", attributes: { "data-contents": state.sliceDoc(from, to) } }).range(from, to));
        }
        if (rule.prefixType && rule.prefixType !== "none") {
          const marker = new PrefixWidget(this.view.dom.ownerDocument, runtimeApp, rule, () => this.view.dispatch({ effects: refreshDecorations.of(null) }));
          widgetDecos.push(Decoration.widget({ widget: marker, side: -1 }).range(from, from));
        }
      }
      for (const [lineNumber, value] of lineRules) {
        const line = state.doc.line(lineNumber);
        const classes = [toInternalClassName(value.ruleId), ...(value.rule.class || "").split(/\s+/).filter(Boolean)].join(" ");
        tokenDecos.push(Decoration.line({ class: classes }).range(line.from));
      }
      return {
        token: Decoration.set(tokenDecos.sort((a, b) => a.from - b.from || a.to - b.to)),
        widget: Decoration.set(widgetDecos.sort((a, b) => a.from - b.from)),
      };
    }
  },
  {
    provide: plugin => [
      EditorView.decorations.of(view => view.plugin(plugin)?.decorations || Decoration.none),
      EditorView.decorations.of(view => view.plugin(plugin)?.widgetDecorations || Decoration.none),
    ],
  }
);

class PrefixWidget extends WidgetType {
  constructor(private readonly doc: Document, private readonly app: App | null, private readonly rule: SearchQueries[string], private readonly onImageError: () => void) { super(); }
  toDOM() {
    if (!this.app) return this.doc.adoptNode(createSpan());
    return createPrefixNode(this.app, this.doc, this.rule, this.onImageError) || this.doc.adoptNode(createSpan());
  }
  eq(other: PrefixWidget) { return this.rule.prefixType === other.rule.prefixType && this.rule.prefixValue === other.rule.prefixValue && JSON.stringify(this.rule.prefixValues) === JSON.stringify(other.rule.prefixValues) && this.rule.textColor === other.rule.textColor && this.rule.iconInheritColor === other.rule.iconInheritColor && this.rule.backgroundIncludesMarker === other.rule.backgroundIncludesMarker && this.rule.color === other.rule.color && this.rule.imageWidth === other.rule.imageWidth && this.rule.imageHeight === other.rule.imageHeight && this.app === other.app; }
  ignoreEvent() { return true; }
}
