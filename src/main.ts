import { Extension } from "@codemirror/state";
import { MarkdownRenderChild, MarkdownView, Plugin, setIcon, TFile } from "obsidian";
import { buildStyles, staticHighlighterExtension } from "./highlighters/static";
import addIcons from "./icons/customIcons";
import { DEFAULT_SETTINGS, DynamicHighlightsSettings } from "./settings/settings";
import { SettingTab } from "./settings/ui";
import { isReadingBody, isReadingText } from "./highlighters/scope";
import { scopeCustomCSS } from "./highlighters/custom-css";

interface CustomCSS {
  css: string;
  enabled: boolean;
}

export default class DynamicHighlightsPlugin extends Plugin {
  settings: DynamicHighlightsSettings;
  extensions: Extension[];
  styles: Extension;
  staticHighlighter: Extension;
  customCSS: Record<string, CustomCSS>;
  styleEl: HTMLElement;
  settingsTab: SettingTab;

  async onload() {
    await this.loadSettings();
    this.settingsTab = new SettingTab(this.app, this);
    this.addSettingTab(this.settingsTab);
    addIcons();
    this.staticHighlighter = staticHighlighterExtension(this);
    this.extensions = [];
    this.updateStaticHighlighter();
    this.updateStyles();
    this.registerEditorExtension(this.extensions);
    this.initCSS();
    this.registerMarkdownPostProcessor((el, ctx) => {
      if (el.isConnected) {
        this.decorateReadingView(el);
        return;
      }
      // The renderer can run processors before attaching a section to its view.
      // Wait until attachment, then check the actual containing note body.
      const child = new MarkdownRenderChild(el);
      child.onload = () => {
        const win = el.ownerDocument.defaultView;
        if (!win) return;
        const frame = win.requestAnimationFrame(() => this.decorateReadingView(el));
        child.register(() => win.cancelAnimationFrame(frame));
      };
      ctx.addChild(child);
    });
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    this.settings.staticHighlighter = Object.assign({}, DEFAULT_SETTINGS.staticHighlighter, this.settings.staticHighlighter);
    if (this.settings.selectionHighlighter.highlightDelay < 200) {
      this.settings.selectionHighlighter.highlightDelay = 200;
      this.saveSettings;
    }
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  initCSS() {
    let styleEl = (this.styleEl = this.app.workspace.containerEl.ownerDocument.createElement("style"));
    styleEl.setAttribute("type", "text/css");
    styleEl.ownerDocument.head.appendChild(styleEl);
    this.register(() => styleEl.detach());
    this.updateCustomCSS();
  }

  updateCustomCSS() {
    this.styleEl.textContent = Object.values(this.settings.staticHighlighter.queries)
      .filter(q => q.enabled !== false)
      .map(q => q.css ? scopeCustomCSS(q.css, this.styleEl.ownerDocument) : "")
      .join("\n");
    this.app.workspace.trigger("css-change");
    this.refreshReadingViews();
  }

  updateStyles() {
    this.extensions.remove(this.styles);
    this.styles = buildStyles(this);
    this.extensions.push(this.styles);
    this.app.workspace.updateOptions();
    this.refreshReadingViews();
  }

  updateStaticHighlighter() {
    this.extensions.remove(this.staticHighlighter);
    this.staticHighlighter = staticHighlighterExtension(this);
    this.extensions.push(this.staticHighlighter);
    this.app.workspace.updateOptions();
    this.refreshReadingViews();
  }

  refreshReadingViews() {
    this.app.workspace.iterateAllLeaves(leaf => {
      if (!(leaf.view instanceof MarkdownView)) return;
      const view: any = leaf.view;
      if (view.getMode?.() !== "preview") return;
      view.previewMode?.rerender?.(true);
    });
  }

  decorateReadingView(rootEl: HTMLElement) {
    if (!isReadingBody(rootEl)) return;
    const compiledRules = this.compileReadingRules();
    if (compiledRules.length === 0) return;

    const ownerDocument = rootEl.ownerDocument;
    const walker = ownerDocument.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const textNode = node as Text;
      if (!textNode.nodeValue?.trim()) continue;
      const parent = textNode.parentElement;
      if (!parent) continue;
      if (!isReadingText(parent)) continue;
      textNodes.push(textNode);
    }

    for (const textNode of textNodes) {
      const original = textNode.nodeValue || "";
      const matches = this.collectMatches(original, compiledRules);
      if (matches.length === 0) continue;

      const fragment = ownerDocument.createDocumentFragment();
      let cursor = 0;
      for (const match of matches) {
        if (match.from > cursor) {
          fragment.appendChild(ownerDocument.createTextNode(original.slice(cursor, match.from)));
        }
        fragment.appendChild(this.createReadingMark(match.rule, original.slice(match.from, match.to), ownerDocument));
        cursor = match.to;
      }
      if (cursor < original.length) {
        fragment.appendChild(ownerDocument.createTextNode(original.slice(cursor)));
      }
      textNode.replaceWith(fragment);
    }
  }

  compileReadingRules() {
    const queries = this.settings.staticHighlighter.queries;
    return this.settings.staticHighlighter.queryOrder
      .map((ruleId, priority) => ({ ruleId, priority, rule: queries[ruleId] }))
      .filter(item => item.rule && item.rule.enabled !== false && item.rule.query?.trim())
      .map(item => ({
        ...item,
        mode: item.rule.queryMode || (item.rule.regex ? "regex" : "single"),
      }));
  }

  collectMatches(text: string, rules: any[]) {
    const all: Array<{ from: number; to: number; priority: number; rule: any }> = [];
    for (const item of rules) {
      const mode = item.mode;
      if (mode === "regex") {
        try {
          const reg = new RegExp(item.rule.query, "g");
          let m: RegExpExecArray | null;
          while ((m = reg.exec(text))) {
            const from = m.index;
            const to = from + m[0].length;
            if (to > from) all.push({ from, to, priority: item.priority, rule: item.rule });
            if (reg.lastIndex === m.index) reg.lastIndex++;
          }
        } catch {
          continue;
        }
      } else if (mode === "multiple") {
        const keywords = splitKeywords(item.rule.query);
        for (const keyword of keywords) {
          let from = text.indexOf(keyword);
          while (from !== -1) {
            all.push({ from, to: from + keyword.length, priority: item.priority, rule: item.rule });
            from = text.indexOf(keyword, from + keyword.length);
          }
        }
      } else {
        const keyword = item.rule.query;
        let from = text.indexOf(keyword);
        while (from !== -1) {
          all.push({ from, to: from + keyword.length, priority: item.priority, rule: item.rule });
          from = text.indexOf(keyword, from + keyword.length);
        }
      }
    }

    all.sort((a, b) => a.from - b.from || a.priority - b.priority || b.to - a.to);
    const selected: Array<{ from: number; to: number; rule: any }> = [];
    let cursor = -1;
    for (const m of all) {
      if (m.from < cursor) continue;
      selected.push({ from: m.from, to: m.to, rule: m.rule });
      cursor = m.to;
    }
    return selected;
  }

  createReadingMark(rule: any, text: string, ownerDocument: Document) {
    const span = ownerDocument.createElement("span");
    span.addClass("keyword-decorator-reading-mark");
    if (rule.class) span.addClass(rule.class);
    if (rule.textColor) span.style.color = rule.textColor;
    if (rule.color) span.style.backgroundColor = rule.color;
    if (rule.fontWeight) span.style.fontWeight = rule.fontWeight;
    if (rule.italic) span.style.fontStyle = "italic";
    if (rule.underline) span.style.textDecoration = "underline";

    const prefix = this.createPrefixNode(rule.prefixType, rule.prefixValue, ownerDocument);
    if (prefix) span.appendChild(prefix);
    span.appendChild(ownerDocument.createTextNode(text));
    return span;
  }

  createPrefixNode(prefixType: string | undefined, prefixValue: string | undefined, ownerDocument: Document) {
    if (!prefixType || prefixType === "none") return null;
    const prefix = ownerDocument.createElement("span");
    prefix.addClass("keyword-decorator-prefix");

    if (prefixType === "emoji") {
      prefix.textContent = prefixValue || "✨";
      return prefix;
    }
    if (prefixType === "icon") {
      try {
        setIcon(prefix, prefixValue || "sparkles");
      } catch {
        setIcon(prefix, "image-off");
      }
      return prefix;
    }
    if (prefixType === "image") {
      const src = this.resolveReadingImage(prefixValue || "");
      if (!src) {
        setIcon(prefix, "image-off");
        return prefix;
      }
      const img = ownerDocument.createElement("img");
      img.src = src;
      img.alt = "";
      img.addClass("keyword-decorator-prefix-image");
      img.onerror = () => {
        while (prefix.firstChild) prefix.removeChild(prefix.firstChild);
        setIcon(prefix, "image-off");
      };
      prefix.appendChild(img);
      return prefix;
    }
    return null;
  }

  resolveReadingImage(input: string) {
    const trimmed = input.trim();
    if (!trimmed) return "";
    if (/^(https?:|data:|app:|file:)/.test(trimmed)) return trimmed;
    const normalized = trimmed.replace(/^!?\[\[/, "").replace(/\]\]$/, "").split("|")[0].trim();
    const byPath = this.app.vault.getAbstractFileByPath(normalized);
    if (byPath instanceof TFile) return this.app.vault.getResourcePath(byPath);

    const lower = normalized.toLowerCase();
    const byName = this.app.vault.getFiles().find(file => file.name.toLowerCase() === lower);
    if (byName) return this.app.vault.getResourcePath(byName);

    const withoutExt = lower.replace(/\.[^.]+$/, "");
    const byBase = this.app.vault.getFiles().find(file => file.basename.toLowerCase() === withoutExt);
    return byBase ? this.app.vault.getResourcePath(byBase) : "";
  }
}

function splitKeywords(value: string) {
  return value
    .split(/[\n,]/g)
    .map(v => v.trim())
    .filter(Boolean);
}
