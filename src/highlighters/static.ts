// originally from: https://github.com/codemirror/search/blob/main/src/selection-match.ts
import { SearchCursor } from "@codemirror/search";
import { combineConfig, Compartment, Extension, Facet, Range } from "@codemirror/state";
import { syntaxTree, tokenClassNodeProp } from "@codemirror/language";
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate, WidgetType } from "@codemirror/view";
import { cloneDeep } from "lodash";
import { setIcon, TFile } from "obsidian";
import DynamicHighlightsPlugin from "src/main";
import { SearchQueries } from "src/settings/settings";
import { StyleSpec } from "style-mod";
import { RegExpCursor } from "./regexp-cursor";

export type StaticHighlightOptions = {
  queries: SearchQueries;
  queryOrder: string[];
};

const defaultOptions: StaticHighlightOptions = {
  queries: {},
  queryOrder: [],
};

export const staticHighlightConfig = Facet.define<StaticHighlightOptions, Required<StaticHighlightOptions>>({
  combine(options: readonly StaticHighlightOptions[]) {
    return combineConfig(options, defaultOptions, {
      queries: (a, b) => a || b,
      queryOrder: (a, b) => a || b,
    });
  },
});

const staticHighlighterCompartment = new Compartment();
let runtimePlugin: DynamicHighlightsPlugin | null = null;
let imagePrefixCache = new Map<string, string>();

export function staticHighlighterExtension(plugin: DynamicHighlightsPlugin): Extension {
  runtimePlugin = plugin;
  imagePrefixCache = new Map<string, string>();
  let ext: Extension[] = [staticHighlighter];
  let options = plugin.settings.staticHighlighter;
  ext.push(staticHighlightConfig.of(cloneDeep(options)));
  return ext;
}

export interface Styles {
  [selector: string]: StyleSpec;
}

export function buildStyles(plugin: DynamicHighlightsPlugin) {
  let queries = Object.entries(plugin.settings.staticHighlighter.queries);
  let styles: Styles = {};
  for (let [ruleId, query] of queries) {
    let classNames = [toInternalClassName(ruleId), query.class].filter(Boolean).map(cls => `.${cls}`);
    if (classNames.length === 0) continue;
    const style: StyleSpec = {};
    if (query.color) style.backgroundColor = query.color;
    if (query.textColor) style.color = query.textColor;
    if (query.fontWeight) style.fontWeight = query.fontWeight;
    if (query.italic) style.fontStyle = "italic";
    if (query.underline) style.textDecoration = "underline";
    if (Object.keys(style).length === 0) continue;
    styles[classNames.join(", ")] = style;
  }
  let theme = EditorView.theme(styles);
  return theme;
}

function toInternalClassName(ruleId: string) {
  return `kd-rule-${ruleId}`.replace(/[^a-zA-Z0-9_-]/g, "-");
}

function splitKeywords(value: string) {
  return value
    .split(/[\n,]/g)
    .map(v => v.trim())
    .filter(Boolean);
}

class IconWidget extends WidgetType {
  className: string | undefined;
  prefixType?: string;
  prefixValue?: string;

  constructor(className?: string, prefixType?: string, prefixValue?: string) {
    super();
    this.className = className;
    this.prefixType = prefixType;
    this.prefixValue = prefixValue;
  }

  toDOM() {
    let headerEl = document.createElement("span");
    this.className && headerEl.addClass(this.className);
    if (this.prefixType === "emoji") {
      headerEl.addClass("keyword-decorator-prefix");
      headerEl.textContent = this.prefixValue || "";
    } else if (this.prefixType === "icon") {
      headerEl.addClass("keyword-decorator-prefix");
      try {
        setIcon(headerEl, this.prefixValue || "dot-network");
      } catch {
        headerEl.textContent = this.prefixValue || "*";
      }
    } else if (this.prefixType === "image") {
      headerEl.addClass("keyword-decorator-prefix");
      if (!this.prefixValue) {
        setIcon(headerEl, "image-off");
        return headerEl;
      }
      const img = document.createElement("img");
      img.src = this.prefixValue || "";
      img.alt = "";
      img.addClass("keyword-decorator-prefix-image");
      img.onerror = () => {
        while (headerEl.firstChild) {
          headerEl.removeChild(headerEl.firstChild);
        }
        setIcon(headerEl, "image-off");
      };
      headerEl.appendChild(img);
    }
    return headerEl;
  }

  ignoreEvent() {
    return true;
  }
}

const staticHighlighter = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    widgetDecorations: DecorationSet;
    private recomputeTimer: number | null = null;
    private readonly docChangeDebounceMs = 90;

    constructor(view: EditorView) {
      let { token, widget } = this.getDeco(view);
      this.decorations = token;
      this.widgetDecorations = widget;
    }

    update(update: ViewUpdate) {
      let reconfigured = update.startState.facet(staticHighlightConfig) !== update.state.facet(staticHighlightConfig);
      if (update.viewportChanged || reconfigured) {
        this.clearRecomputeTimer();
        let { token, widget } = this.getDeco(update.view);
        this.decorations = token;
        this.widgetDecorations = widget;
        return;
      }

      if (update.docChanged) {
        this.scheduleRecompute(update.view);
      }
    }

    destroy() {
      this.clearRecomputeTimer();
    }

    private scheduleRecompute(view: EditorView) {
      this.clearRecomputeTimer();
      this.recomputeTimer = window.setTimeout(() => {
        this.recomputeTimer = null;
        let { token, widget } = this.getDeco(view);
        this.decorations = token;
        this.widgetDecorations = widget;
        view.dispatch({});
      }, this.docChangeDebounceMs);
    }

    private clearRecomputeTimer() {
      if (this.recomputeTimer !== null) {
        window.clearTimeout(this.recomputeTimer);
        this.recomputeTimer = null;
      }
    }

    getDeco(view: EditorView): {
      token: DecorationSet;
      widget: DecorationSet;
    } {
      let { state } = view,
        tokenDecos: Range<Decoration>[] = [],
        widgetDecos: Range<Decoration>[] = [],
        queries = Object.entries(view.state.facet(staticHighlightConfig).queries);
      const tree = syntaxTree(view.state);
      for (let part of view.visibleRanges) {
        for (let [ruleId, query] of queries) {
          if (query.enabled === false || !query.query?.trim()) continue;
          const internalClass = toInternalClassName(ruleId);
          const mergedClass = [internalClass, query.class].filter(Boolean).join(" ");

          const mode = query.queryMode || (query.regex ? "regex" : "single");
          const processMatch = (activeCursor: RegExpCursor | SearchCursor) => {
            let { from, to } = activeCursor.value;
            let string = state.sliceDoc(from, to).trim();
            const linePos = view.state.doc.lineAt(from)?.from;
            let syntaxNode = tree.resolveInner(linePos + 1),
              nodeProps = syntaxNode.type.prop(tokenClassNodeProp),
              excludedSection = ["hmd-codeblock", "hmd-frontmatter"].find(token =>
                nodeProps?.split(" ").includes(token)
              );
            if (excludedSection) return;
            const markDeco = Decoration.mark({ class: mergedClass, attributes: { "data-contents": string } });
            tokenDecos.push(markDeco.range(from, to));
            if (query.prefixType && query.prefixType !== "none" && query.prefixValue) {
              const prefixValue = resolvePrefixValue(query.prefixType, query.prefixValue);
              let prefixDeco = Decoration.widget({
                widget: new IconWidget(undefined, query.prefixType, prefixValue),
                side: -1,
              });
              widgetDecos.push(prefixDeco.range(from, from));
            }
          };

          if (mode === "multiple") {
            const terms = splitKeywords(query.query);
            for (const term of terms) {
              const multiCursor = new SearchCursor(state.doc, term, part.from, part.to);
              while (!multiCursor.next().done) {
                processMatch(multiCursor);
              }
            }
            continue;
          }

          try {
            const cursor =
              mode === "regex"
                ? new RegExpCursor(state.doc, query.query, {}, part.from, part.to)
                : new SearchCursor(state.doc, query.query, part.from, part.to);
            while (!cursor.next().done) {
              processMatch(cursor);
            }
          } catch (err) {
            console.debug(err);
          }
        }
      }
      return {
        token: Decoration.set(tokenDecos.sort((a, b) => a.from - b.from)),
        widget: Decoration.set(widgetDecos.sort((a, b) => a.from - b.from)),
      };
    }
  },
  {
    provide: plugin => [
      EditorView.decorations.of(v => v.plugin(plugin)?.decorations || Decoration.none),
      EditorView.decorations.of(v => v.plugin(plugin)?.widgetDecorations || Decoration.none),
    ],
  }
);

function resolvePrefixValue(prefixType: string, value: string) {
  if (prefixType !== "image") return value;
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  if (/^(https?:|data:|app:|file:)/.test(trimmed)) return trimmed;

  const cached = imagePrefixCache.get(trimmed);
  if (cached !== undefined) {
    return cached;
  }

  const path = trimmed.replace(/^!?\[\[/, "").replace(/\]\]$/, "").split("|")[0].trim();
  const file = resolveVaultImage(path);
  if (file instanceof TFile) {
    const resolved = runtimePlugin!.app.vault.getResourcePath(file);
    imagePrefixCache.set(trimmed, resolved);
    return resolved;
  }
  imagePrefixCache.set(trimmed, "");
  return "";
}

function resolveVaultImage(pathOrName: string): TFile | null {
  if (!runtimePlugin) return null;
  const byPath = runtimePlugin.app.vault.getAbstractFileByPath(pathOrName);
  if (byPath instanceof TFile) {
    return byPath;
  }

  const normalized = pathOrName.toLowerCase();
  const files = runtimePlugin.app.vault.getFiles();
  const byName = files.find(file => file.name.toLowerCase() === normalized);
  if (byName) return byName;

  const withoutExt = normalized.replace(/\.[^.]+$/, "");
  return files.find(file => file.basename.toLowerCase() === withoutExt) || null;
}
