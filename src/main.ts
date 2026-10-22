import { Extension } from "@codemirror/state";
import { MarkdownRenderChild, MarkdownView, Plugin, TAbstractFile, TFile } from "obsidian";
import { buildStyles, staticHighlighterExtension } from "./highlighters/static";
import { compileRules, CompiledRule, findMatches, TextMatch } from "./highlighters/matching";
import addIcons from "./icons/customIcons";
import { clearImageCache, createPrefixNode } from "./markers";
import { DynamicHighlightsSettings, normalizeSettings } from "./settings/settings";
import { SettingTab } from "./settings/ui";
import { getEffectiveQueries } from "./settings/groups";
import { installDefaultPresets } from "./settings/presets";
import { isReadingBody, isReadingText, READING_EXCLUDED_SELECTOR } from "./highlighters/scope";
import { scopeCustomCSS } from "./highlighters/custom-css";

interface CustomCSS { css: string; enabled: boolean }
interface PendingSave { resolve: () => void; reject: (error: unknown) => void }

export default class DynamicHighlightsPlugin extends Plugin {
  settings: DynamicHighlightsSettings;
  extensions: Extension[] = [];
  styles: Extension;
  staticHighlighter: Extension;
  customCSS: Record<string, CustomCSS> = {};
  styleEl?: HTMLElement;
  settingsTab: SettingTab;
  private styleElements = new Map<Document, HTMLStyleElement>();
  private lastAppliedSettings = "";
  private lastCustomCSS = "";
  private compiledReading: CompiledRule[] = [];
  private readingRulesDirty = true;
  private saveTimer: number | null = null;
  private pendingSaves: PendingSave[] = [];
  private saveQueue: Promise<void> = Promise.resolve();
  private customCSSInitialized = false;
  private readonly settingsDocuments = new Map<Document, number>();
  private imageRefreshTimer: number | null = null;

  async onload() {
    await this.loadSettings();
    this.settingsTab = new SettingTab(this.app, this);
    this.addSettingTab(this.settingsTab);
    addIcons();
    this.staticHighlighter = staticHighlighterExtension(this);
    this.styles = buildStyles(this);
    this.extensions = [this.staticHighlighter, this.styles];
    this.registerEditorExtension(this.extensions);
    this.initCSS();
    this.registerEvent(this.app.workspace.on("window-open", () => this.syncCustomCSS()));
    this.registerMarkdownPostProcessor((el, ctx) => {
      if (el.isConnected) { this.decorateReadingView(el); return; }
      const child = new MarkdownRenderChild(el);
      child.onload = () => {
        const win = el.ownerDocument.defaultView;
        if (!win) return;
        const frame = win.requestAnimationFrame(() => this.decorateReadingView(el));
        child.register(() => win.cancelAnimationFrame(frame));
      };
      ctx.addChild(child);
    });
    this.lastAppliedSettings = this.runtimeSignature();
    this.registerEvent(this.app.vault.on("create", file => this.onVaultFileChanged(file)));
    this.registerEvent(this.app.vault.on("delete", file => this.onVaultFileChanged(file)));
    this.registerEvent(this.app.vault.on("rename", (file, oldPath) => this.onVaultFileChanged(file, oldPath)));
  }

  async loadSettings() {
    this.settings = normalizeSettings(await this.loadData());
    if (installDefaultPresets(this.settings.staticHighlighter)) await this.saveData(this.settings);
  }

  settingsChanged(): Promise<void> {
    const promise = new Promise<void>((resolve, reject) => this.pendingSaves.push({ resolve, reject }));
    if (this.saveTimer !== null) window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = null;
      this.applySettingsIfChanged();
      void this.flushPendingSaves().catch(() => undefined);
    }, 200);
    return promise;
  }

  async saveSettings() {
    if (this.saveTimer !== null || this.pendingSaves.length) {
      if (this.saveTimer !== null) window.clearTimeout(this.saveTimer);
      this.saveTimer = null;
      this.applySettingsIfChanged();
      await this.flushPendingSaves();
      return;
    }
    this.applySettingsIfChanged();
    await this.enqueueSave(this.settings);
  }

  private async flushPendingSaves() {
    const pending = this.pendingSaves.splice(0);
    if (!pending.length) return;
    try {
      await this.enqueueSave(this.settings);
      pending.forEach(item => item.resolve());
    } catch (error) {
      pending.forEach(item => item.reject(error));
      throw error;
    }
  }

  private enqueueSave(settings: DynamicHighlightsSettings): Promise<void> {
    const snapshot = structuredClone(settings);
    const write = this.saveQueue.catch(() => undefined).then(async () => { await this.saveData(snapshot); });
    this.saveQueue = write;
    return write;
  }

  private runtimeSignature() {
    const queries = getEffectiveQueries(this.settings.staticHighlighter);
    return JSON.stringify({
      enabled: this.settings.enabled,
      decorateInSourceMode: this.settings.staticHighlighter.decorateInSourceMode,
      order: this.settings.staticHighlighter.queryOrder,
      queries: Object.fromEntries(Object.entries(queries).map(([id, rule]) => [id, {
        ...rule,
        name: undefined,
      }])),
    });
  }

  private applySettingsIfChanged() {
    const signature = this.runtimeSignature();
    if (signature === this.lastAppliedSettings) return;
    this.staticHighlighter = staticHighlighterExtension(this);
    this.styles = buildStyles(this);
    this.extensions.splice(0, this.extensions.length, this.staticHighlighter, this.styles);
    this.readingRulesDirty = true;
    this.lastAppliedSettings = signature;
    this.app.workspace.updateOptions();
    this.updateCustomCSS();
    this.refreshReadingViews();
  }

  private onVaultFileChanged(file: TAbstractFile, oldPath?: string) {
    const isImage = (path: string) => /\.(?:png|jpe?g|gif|webp|avif|bmp|svg)$/i.test(path);
    if (!(file instanceof TFile) || (!isImage(file.path) && !(oldPath && isImage(oldPath)))) return;
    if (this.imageRefreshTimer !== null) window.clearTimeout(this.imageRefreshTimer);
    this.imageRefreshTimer = window.setTimeout(() => {
      this.imageRefreshTimer = null;
      this.refreshImageMarkers();
    }, 100);
  }

  private refreshImageMarkers() {
    clearImageCache(this.app);
    this.staticHighlighter = staticHighlighterExtension(this);
    this.extensions.splice(0, this.extensions.length, this.staticHighlighter, this.styles);
    this.app.workspace.updateOptions();
    this.refreshReadingViews();
  }

  initCSS() {
    this.syncCustomCSS();
    this.register(() => {
      if (this.saveTimer !== null) window.clearTimeout(this.saveTimer);
      this.saveTimer = null;
      if (this.imageRefreshTimer !== null) window.clearTimeout(this.imageRefreshTimer);
      this.imageRefreshTimer = null;
      if (this.pendingSaves.length) {
        void this.flushPendingSaves().catch(() => undefined);
      }
      for (const doc of this.getDocuments()) {
        for (const mark of Array.from(doc.querySelectorAll<HTMLElement>(".keyword-decorator-reading-mark, .keyword-decorator-reading-line"))) {
          const text = mark.getAttribute("data-contents") || "";
          mark.replaceWith(doc.createTextNode(text));
        }
      }
      for (const style of this.styleElements.values()) style.remove();
      this.styleElements.clear();
      this.settingsDocuments.clear();
    });
  }

  registerSettingsDocument(doc: Document): () => void {
    this.settingsDocuments.set(doc, (this.settingsDocuments.get(doc) || 0) + 1);
    if (doc.head && doc.defaultView && !doc.defaultView.closed) {
      const style = this.ensureDocumentStyle(doc);
      style.textContent = scopeCustomCSS(this.lastCustomCSS, doc);
    }
    return () => {
      const count = this.settingsDocuments.get(doc) || 0;
      if (count <= 1) this.settingsDocuments.delete(doc);
      else this.settingsDocuments.set(doc, count - 1);
      if (!this.isDocumentInWorkspace(doc)) this.removeDocumentStyle(doc);
    };
  }

  private getDocuments(): Document[] {
    const docs = new Set<Document>();
    const rootDoc = this.app.workspace.containerEl.ownerDocument;
    if (rootDoc?.head) docs.add(rootDoc);
    this.app.workspace.iterateAllLeaves(leaf => {
      const doc = leaf.view.containerEl.ownerDocument;
      if (doc?.head && doc.defaultView && !doc.defaultView.closed) docs.add(doc);
    });
    for (const doc of this.settingsDocuments.keys()) {
      if (doc.head && doc.defaultView && !doc.defaultView.closed) docs.add(doc);
      else this.settingsDocuments.delete(doc);
    }
    for (const doc of this.styleElements.keys()) {
      if (!doc.defaultView || doc.defaultView.closed) this.removeDocumentStyle(doc);
    }
    return Array.from(docs);
  }

  private isDocumentInWorkspace(doc: Document): boolean {
    if (doc === this.app.workspace.containerEl.ownerDocument) return true;
    let found = false;
    this.app.workspace.iterateAllLeaves(leaf => { if (leaf.view.containerEl.ownerDocument === doc) found = true; });
    return found;
  }

  private removeDocumentStyle(doc: Document) {
    const style = this.styleElements.get(doc);
    style?.remove();
    this.styleElements.delete(doc);
    if (this.styleEl === style) this.styleEl = undefined;
  }

  private syncCustomCSS() {
    const css = this.getCustomCSS();
    this.lastCustomCSS = css;
    for (const doc of this.getDocuments()) {
      this.ensureDocumentStyle(doc).textContent = scopeCustomCSS(css, doc);
    }
    this.customCSSInitialized = true;
    this.app.workspace.trigger("css-change");
  }

  private ensureDocumentStyle(doc: Document): HTMLStyleElement {
    let style = this.styleElements.get(doc);
    if (!style) {
      style = doc.adoptNode(createEl("style"));
      doc.head.appendChild(style);
      this.styleElements.set(doc, style);
      if (!this.styleEl) this.styleEl = style;
    }
    return style;
  }

  updateCustomCSS() {
    const css = this.getCustomCSS();
    if (css === this.lastCustomCSS && this.customCSSInitialized) return;
    this.syncCustomCSS();
  }

  private getCustomCSS() {
    if (!this.settings.enabled) return "";
    const queries = getEffectiveQueries(this.settings.staticHighlighter);
    return Object.entries(queries)
      .filter(([, query]) => query.enabled !== false && query.css)
      .map(([id, query]) => query.css!.replace(/&/g, `.${internalClassName(id)}`))
      .join("\n");
  }

  updateStyles() {
    if (this.runtimeSignature() === this.lastAppliedSettings) return;
    this.styles = buildStyles(this);
    this.extensions.splice(0, this.extensions.length, this.staticHighlighter, this.styles);
    this.app.workspace.updateOptions();
    this.refreshReadingViews();
  }

  updateStaticHighlighter() {
    if (this.runtimeSignature() === this.lastAppliedSettings) return;
    this.staticHighlighter = staticHighlighterExtension(this);
    this.extensions.splice(0, this.extensions.length, this.staticHighlighter, this.styles);
    this.app.workspace.updateOptions();
    this.refreshReadingViews();
  }

  refreshReadingViews() {
    this.app.workspace.iterateAllLeaves(leaf => {
      if (!(leaf.view instanceof MarkdownView)) return;
      const view = leaf.view as MarkdownView & { getMode?: () => string; previewMode?: { rerender?: (force: boolean) => void } };
      if (view.getMode?.() === "preview") view.previewMode?.rerender?.(true);
    });
  }

  private getReadingRules() {
    if (this.readingRulesDirty) {
      this.compiledReading = this.settings.enabled
        ? compileRules(getEffectiveQueries(this.settings.staticHighlighter), this.settings.staticHighlighter.queryOrder)
        : [];
      this.readingRulesDirty = false;
    }
    return this.compiledReading;
  }

  decorateReadingView(rootEl: HTMLElement) {
    if (!isReadingBody(rootEl)) return;
    const compiledRules = this.getReadingRules();
    if (!compiledRules.length) return;
    const doc = rootEl.ownerDocument;
    const blockSelector = "p,h1,h2,h3,h4,h5,h6,li,blockquote,td,th";
    const blocks = Array.from(rootEl.querySelectorAll<HTMLElement>(blockSelector));
    if (rootEl.matches(blockSelector)) blocks.unshift(rootEl);
    const excluded = READING_EXCLUDED_SELECTOR;
    for (const block of blocks) {
      if (!isReadingText(block)) continue;
      const flat = flattenReadingBlock(block, blockSelector, excluded);
      if (!flat.text) continue;
      const matches = findMatches(flat.text, compiledRules, match => !flat.text.slice(match.from, match.to).includes("\u0000"));
      if (!matches.length) continue;
      const wholeLines = new Map<number, TextMatch>();
      const hiddenMatches = new Set<string>();
      const hiddenElements = new Map<string, HTMLElement[]>();
      for (const match of matches) {
        if (!match.rule.styleWholeLine) continue;
        const start = lineStart(flat.text, match.from);
        let line = start;
        while (line < match.to) {
          const current = wholeLines.get(line);
          if (!current || match.priority < current.priority) wholeLines.set(line, match);
          const next = flat.text.indexOf("\n", line);
          if (next < 0 || next + 1 >= match.to) break;
          line = next + 1;
        }
      }
      for (const segment of flat.segments) {
        const textNode = segment.node;
        const original = textNode.nodeValue || "";
        if (!original.length) continue;
        const cuts = new Set<number>([0, original.length]);
        for (const match of matches) {
          for (const origin of [match.from, match.to]) {
            if (origin >= segment.from && origin <= segment.to) cuts.add(origin - segment.from);
          }
        }
        for (let offset = 0; offset < original.length; offset++) {
          if (original[offset] === "\n") { cuts.add(offset); cuts.add(offset + 1); }
        }
        const boundaries = Array.from(cuts).sort((a, b) => a - b);
        const fragment = doc.adoptNode(createFragment());
        for (let index = 0; index < boundaries.length - 1; index++) {
          const localFrom = boundaries[index];
          const localTo = boundaries[index + 1];
          if (localTo <= localFrom) continue;
          const from = segment.from + localFrom;
          const to = segment.from + localTo;
          const match = matches.find(item => item.from < to && item.to > from);
          const lineRule = wholeLines.get(lineStart(flat.text, from));
          const styleMatch = lineRule || match;
          if (!styleMatch) {
            fragment.appendChild(doc.createTextNode(original.slice(localFrom, localTo)));
            continue;
          }
          const rule = styleMatch.rule as DynamicHighlightsSettings["staticHighlighter"]["queries"][string];
          const wrapper = doc.adoptNode(createSpan());
          wrapper.classList.add(lineRule ? "keyword-decorator-reading-line" : "keyword-decorator-reading-mark");
          if (match && lineRule) wrapper.classList.add("keyword-decorator-reading-mark");
          wrapper.classList.add(internalClassName(styleMatch.ruleId));
          if (rule.class) for (const className of rule.class.split(/\s+/).filter(Boolean)) wrapper.classList.add(className);
          const text = original.slice(localFrom, localTo);
          wrapper.setAttribute("data-contents", text);
          applyRuleStyles(wrapper, rule, false);
          const matchStartsHere = match && match.from >= from && match.from < to;
          let prefix: HTMLElement | null = null;
          if (matchStartsHere) {
            const markerRule = match.rule as DynamicHighlightsSettings["staticHighlighter"]["queries"][string];
            prefix = createPrefixNode(this.app, doc, markerRule, () => {
              for (const hidden of hiddenElements.get(matchKey(match)) || []) hidden.removeClass("keyword-decorator-hidden-text");
            });
            if (prefix) {
              if (markerRule.hideText && (prefix.dataset.kdImageValid === "true" || (markerRule.prefixType === "emoji" && prefix.textContent?.trim()))) hiddenMatches.add(matchKey(match));
            }
          }
          if (prefix) wrapper.appendChild(prefix);
          if (match && hiddenMatches.has(matchKey(match))) {
            wrapper.setAttribute("aria-label", text);
            const hidden = doc.adoptNode(createSpan());
            hidden.classList.add("keyword-decorator-hidden-text");
            hidden.textContent = text;
            const key = matchKey(match);
            hiddenElements.set(key, [...(hiddenElements.get(key) || []), hidden]);
            wrapper.appendChild(hidden);
          } else {
            const textElement = doc.adoptNode(createSpan());
            applyRuleStyles(textElement, rule, true);
            textElement.appendChild(doc.createTextNode(text));
            wrapper.appendChild(textElement);
          }
          fragment.appendChild(wrapper);
        }
        textNode.replaceWith(fragment);
      }
    }
  }
}

interface ReadingTextSegment { node: Text; from: number; to: number }
interface FlattenedReadingBlock { text: string; textNodes: Text[]; segments: ReadingTextSegment[] }

function flattenReadingBlock(block: HTMLElement, blockSelector: string, excluded: string): FlattenedReadingBlock {
  const parts: string[] = [];
  const textNodes: Text[] = [];
  const segments: ReadingTextSegment[] = [];
  let offset = 0;
  const visit = (node: Node) => {
    if (node.nodeType === 3) {
      const textNode = node as Text;
      const parent = textNode.parentElement;
      if (!parent || parent.closest(excluded) || parent.closest(blockSelector) !== block) return;
      const text = textNode.nodeValue || "";
      if (!text) return;
      parts.push(text);
      textNodes.push(textNode);
      segments.push({ node: textNode, from: offset, to: offset + text.length });
      offset += text.length;
      return;
    }
    if (node.nodeType !== 1) return;
    const element = node as HTMLElement;
    if (element.matches(excluded)) {
      if (element.closest(blockSelector) === block) { parts.push("\u0000"); offset++; }
      return;
    }
    if (element.closest(blockSelector) !== block && element !== block) return;
    if (element.tagName === "BR") {
      parts.push("\n");
      offset++;
      return;
    }
    for (const child of Array.from(element.childNodes)) visit(child);
  };
  visit(block);
  return { text: parts.join(""), textNodes, segments };
}

function lineStart(text: string, offset: number) {
  return offset <= 0 ? 0 : text.lastIndexOf("\n", offset - 1) + 1;
}

function internalClassName(ruleId: string) {
  return `kd-rule-${ruleId}`.replace(/[^a-zA-Z0-9_-]/g, "-");
}

function matchKey(match: TextMatch) {
  return `${match.ruleId}:${match.from}:${match.to}`;
}

function applyRuleStyles(element: HTMLElement, rule: DynamicHighlightsSettings["staticHighlighter"]["queries"][string], includeTextBackground: boolean) {
  const properties: Record<string, string> = {};
  if (rule.textColor) properties.color = rule.textColor;
  if (rule.color && includeTextBackground) properties["background-color"] = rule.color;
  if (rule.fontWeight) properties["font-weight"] = rule.fontWeight;
  if (rule.italic) properties["font-style"] = "italic";
  if (rule.underline) properties["text-decoration"] = "underline";
  element.setCssProps(properties);
}
