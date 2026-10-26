import { App, ButtonComponent, Notice, PluginSettingTab, SettingDefinitionItem, SettingPage, TextComponent, ToggleComponent, setIcon } from "obsidian";
import { attachGroupedReorder, GroupedReorderAction } from "./reorder";
import DynamicHighlightsPlugin from "../main";
import { localize, t } from "../i18n";
import { ExportModal } from "./export";
import { ImportModal } from "./import";
import { appendBulkRules, BulkAddModal } from "./bulk";
import { RuleGroup, SearchQuery } from "./settings";
import { appearanceKeys, getEffectiveRule, repairGroupOrder, syncGroupedQueryOrder } from "./groups";
import { moveRuleGroup, moveRuleToGroup, moveRulesToGroup } from "./group-order";
import { renderEditor } from "./rule-editor";
import { renderAppearance } from "./appearance-editor";
import { iconButton, renderPreview, ruleLabel } from "./ui-helpers";
import { getBuiltinEmojiGroup, setBuiltinEmojiEnabled } from "./presets";
import { renderBuiltinEmojiEditor } from "./builtin-editor";

export class SettingTab extends PluginSettingTab {
  icon = "highlighter";
  selectedRuleId: string | null = null;
  private selectedRuleIds = new Set<string>();
  private selectionAnchor: string | null = null;
  private selectionCount!: HTMLElement;
  private selectedGroupId: string | null = null;
  private editorCollapsed = false;
  private editing = false;
  private reorderCleanup?: () => void;
  private list!: HTMLElement;
  private editor!: HTMLElement;
  private layout!: HTMLElement;
  private status?: HTMLElement;
  private count!: HTMLElement;
  private filter = "";
  private rows = new Map<string, HTMLElement>();
  private headers = new Map<string, HTMLElement>();
  private revision = 0;
  private editorCleanup?: () => void;
  private documentCleanup?: () => void;
  private groupClickCleanup?: () => void;
  private rulesPage: DecorationRulesPage | null = null;
  constructor(app: App, public plugin: DynamicHighlightsPlugin) { super(app, plugin); }

  getSettingDefinitions(): SettingDefinitionItem[] {
    return [
      { name: t("enabled"), desc: t("enabledDesc"), render: setting => {
        setting.addToggle(toggle => toggle.setValue(this.plugin.settings.enabled).onChange(value => {
          this.plugin.settings.enabled = value; this.changed(); this.refreshDomState();
        }));
      } },
      { name: t("sourceMode"), desc: t("sourceModeDesc"), visible: () => this.plugin.settings.enabled === true, render: setting => {
        setting.addToggle(toggle => toggle.setValue(this.plugin.settings.staticHighlighter.decorateInSourceMode === true).onChange(value => {
          this.plugin.settings.staticHighlighter.decorateInSourceMode = value; this.changed();
        }));
      } },
      { type: "page", name: localize("Decoration rules", "装饰规则"), desc: localize("Rules, groups, import and export.", "规则、分组与导入导出。"), page: () => new DecorationRulesPage(this) },
    ];
  }
  refresh(): void {
    this.refreshDomState(); this.rulesPage?.display();
  }
  hide(): void { this.rulesPage = null; this.cleanup(); void this.plugin.saveSettings().catch(() => new Notice(t("failed"))); }
  closeRulesPage(page: DecorationRulesPage): void { if (this.rulesPage === page) this.hide(); }
  private cleanup() {
    this.groupClickCleanup?.(); this.groupClickCleanup = undefined;
    this.reorderCleanup?.(); this.reorderCleanup = undefined;
    this.editorCleanup?.(); this.editorCleanup = undefined;
    this.documentCleanup?.(); this.documentCleanup = undefined;
    this.status = undefined; this.rows.clear(); this.headers.clear();
  }
  renderRulesInto(root: HTMLElement, page: DecorationRulesPage) {
    this.cleanup(); this.rulesPage = page; root.empty(); root.addClass("keyword-decorator-settings");
    this.documentCleanup = this.plugin.registerSettingsDocument(root.ownerDocument);
    root.toggleClass("is-paused", !this.plugin.settings.enabled);
    const actions = root.createDiv("kd-toolbar").createDiv("kd-actions");
    this.status = actions.createDiv({ cls: "kd-save-status", text: t("autosave"), attr: { role: "status", "aria-live": "polite" } });
    iconButton(actions, "download", t("import"), () => new ImportModal(this.app, this.plugin).open());
    iconButton(actions, "upload", t("export"), () => new ExportModal(this.app, this.plugin, "All", this.plugin.settings.staticHighlighter.queries, this.plugin.settings).open());
    root.createDiv({ cls: "kd-paused-banner", text: `${t("paused")} · ${t("pausedDesc")}` });
    this.layout = root.createDiv("kd-layout");
    const sidebar = this.layout.createDiv("kd-sidebar"), heading = sidebar.createDiv("kd-list-heading");
    heading.createSpan({ text: t("rules") }); this.count = heading.createSpan("kd-count");
    this.selectionCount = heading.createSpan({ cls: "kd-selection-count", attr: { role: "status", "aria-live": "polite" } });
    const buttons = sidebar.createDiv("kd-list-actions");
    new ButtonComponent(buttons).setButtonText(t("newRule")).setCta().onClick(() => this.addRule());
    iconButton(buttons, "list-plus", t("bulk"), () => this.bulkAdd());
    iconButton(buttons, "folder-plus", localize("New group", "新建分组"), () => this.addGroup());
    iconButton(buttons, "folder-input", localize("Import groups", "导入分组"), () => new ImportModal(this.app, this.plugin, true).open());
    const search = new TextComponent(sidebar).setPlaceholder(t("search")).setValue(this.filter).onChange(value => { this.filter = value; this.renderList(); });
    search.inputEl.addClass("kd-filter"); search.inputEl.setAttribute("aria-label", t("search"));
    this.list = sidebar.createDiv({ cls: "kd-rule-list", attr: { role: "list" } });
    sidebar.createDiv({ cls: "kd-caption kd-priority", text: t("priority") });
    this.editor = this.layout.createDiv("kd-editor");
    const config = this.plugin.settings.staticHighlighter;
    if (this.selectedGroupId && !config.groups?.[this.selectedGroupId]) this.selectedGroupId = null;
    if (!this.selectedGroupId && (!this.selectedRuleId || !config.queries[this.selectedRuleId])) {
      this.selectedRuleId = config.queryOrder[0] || null;
      this.selectedRuleIds = new Set(this.selectedRuleId ? [this.selectedRuleId] : []);
    }
    const selected = this.selectedRuleId && config.queries[this.selectedRuleId];
    if (selected && getBuiltinEmojiGroup(config, selected.groupId)?.ruleId === this.selectedRuleId) {
      this.selectedGroupId = selected.groupId!; this.selectedRuleId = null;
    }
    this.renderList(); this.renderEditor(); this.syncVisibility();
  }
  changed() {
    const revision = ++this.revision;
    this.status?.setText(t("saving"));
    void this.plugin.settingsChanged().then(() => { if (revision === this.revision) this.status?.setText(t("saved")); }, () => this.status?.setText(t("failed")));
    if (this.selectedRuleId) this.updateRow(this.selectedRuleId);
  }
  private syncVisibility() {
    this.layout.toggleClass("is-list-only", this.editorCollapsed);
    this.layout.toggleClass("is-editing", this.editing && !this.editorCollapsed);
  }
  private collapseEditor() { this.editorCollapsed = true; this.editing = false; this.syncVisibility(); }
  private selectRule(id: string) {
    this.groupClickCleanup?.(); this.groupClickCleanup = undefined;
    const config = this.plugin.settings.staticHighlighter, rule = config.queries[id];
    if (rule && getBuiltinEmojiGroup(config, rule.groupId)?.ruleId === id) { this.selectGroup(rule.groupId!); return; }
    this.selectedRuleIds = new Set([id]); this.selectionAnchor = id;
    this.selectedRuleId = id; this.selectedGroupId = null; this.editorCollapsed = false; this.editing = true;
    this.updateSelection(); this.renderEditor(); this.syncVisibility();
  }
  private selectGroup(id: string) {
    this.groupClickCleanup?.(); this.groupClickCleanup = undefined;
    if (this.selectedGroupId === id && this.editing && !this.editorCollapsed) return;
    this.selectedRuleIds.clear(); this.selectionAnchor = null;
    this.selectedGroupId = id; this.selectedRuleId = null; this.editorCollapsed = false; this.editing = true;
    this.updateSelection(); this.renderEditor(); this.syncVisibility();
  }
  private queueGroupSelection(id: string, event: MouseEvent) {
    this.groupClickCleanup?.(); this.groupClickCleanup = undefined;
    // Keyboard clicks are immediate; pointer clicks leave time for a double-click to fold.
    if (event.detail === 0) { this.selectGroup(id); return; }
    if (event.detail > 1) return;
    const win = this.list.ownerDocument.defaultView;
    if (!win) return;
    const timer = win.setTimeout(() => { this.groupClickCleanup = undefined; this.selectGroup(id); }, 240);
    this.groupClickCleanup = () => win.clearTimeout(timer);
  }
  private toggleGroupCollapsed(id: string) {
    this.groupClickCleanup?.(); this.groupClickCleanup = undefined;
    const config = this.plugin.settings.staticHighlighter, group = config.groups?.[id], header = this.headers.get(id);
    if (!group || !header || getBuiltinEmojiGroup(config, id)) return;
    group.collapsed = !group.collapsed;
    const collapsed = !!group.collapsed && !this.filter;
    header.parentElement?.querySelector(".kd-group-items")?.toggleClass("is-collapsed", collapsed);
    const fold = header.querySelector<HTMLElement>(".kd-group-fold");
    if (fold) { setIcon(fold, collapsed ? "chevron-right" : "chevron-down"); fold.setAttribute("aria-expanded", String(!collapsed)); }
    const visible = new Set(this.visibleRuleIds());
    for (const key of this.selectedRuleIds) if (!visible.has(key)) this.selectedRuleIds.delete(key);
    this.updateSelection(); this.changed();
  }
  private revealListItem(el?: HTMLElement) {
    if (!el) return;
    const bounds = this.list.getBoundingClientRect(), item = el.getBoundingClientRect();
    const delta = item.top < bounds.top ? item.top - bounds.top : item.bottom > bounds.bottom ? item.bottom - bounds.bottom : 0;
    if (!delta) return;
    const reduceMotion = this.list.ownerDocument.defaultView?.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.list.scrollTo({ top: this.list.scrollTop + delta, behavior: reduceMotion ? "auto" : "smooth" });
  }
  private visibleRuleIds(): string[] {
    return [...this.rows].filter(([, row]) => !row.closest(".is-collapsed")).map(([id]) => id);
  }
  private updateSelection() {
    for (const [id, header] of this.headers) header.toggleClass("is-selected", id === this.selectedGroupId);
    for (const [id, row] of this.rows) {
      row.toggleClass("is-selected", this.selectedRuleIds.has(id));
      row.querySelector(".kd-select")?.setAttribute("aria-pressed", String(this.selectedRuleIds.has(id)));
    }
    const count = this.selectedRuleIds.size;
    this.selectionCount?.setText(count > 1 ? localize(`${count} selected`, `已选 ${count} 项`) : "");
  }
  private selectWithModifiers(id: string, event: MouseEvent) {
    this.groupClickCleanup?.(); this.groupClickCleanup = undefined;
    const additive = event.ctrlKey || event.metaKey;
    if (!additive && !event.shiftKey) { this.selectRule(id); return; }
    event.preventDefault();
    const visible = this.visibleRuleIds();
    const anchor = visible.indexOf(this.selectionAnchor ?? this.selectedRuleId ?? id), end = visible.indexOf(id);
    if (event.shiftKey && anchor >= 0 && end >= 0) {
      if (!additive) this.selectedRuleIds.clear();
      for (const key of visible.slice(Math.min(anchor, end), Math.max(anchor, end) + 1)) this.selectedRuleIds.add(key);
    } else {
      if (this.selectedRuleIds.has(id)) this.selectedRuleIds.delete(id); else this.selectedRuleIds.add(id);
      this.selectionAnchor = id;
    }
    this.selectedRuleId = this.selectedRuleIds.has(id) ? id : [...this.selectedRuleIds].pop() ?? null;
    this.selectedGroupId = null;
    for (const header of this.headers.values()) header.removeClass("is-selected");
    this.updateSelection(); this.renderEditor();
  }
  private renderList() {
    const scrollTop = this.list.scrollTop;
    this.reorderCleanup?.(); this.list.empty(); this.rows.clear(); this.headers.clear();
    const config = this.plugin.settings.staticHighlighter, groups = config.groups || {};
    this.count.setText(String(config.queryOrder.filter(id => config.queries[id]?.queryMode !== "emoji-shortcodes" || !getBuiltinEmojiGroup(config, config.queries[id]?.groupId)).length));
    const filter = this.filter.toLowerCase();
    const visible = (id: string, group?: RuleGroup) => !filter || `${config.queries[id]?.name || ""} ${config.queries[id]?.query || ""} ${group?.name || ""}`.toLowerCase().includes(filter);
    const drawGroup = (groupId?: string) => {
      const group = groupId ? groups[groupId] : undefined;
      const builtin = getBuiltinEmojiGroup(config, groupId);
      const ids = config.queryOrder.filter(id => config.queries[id] && (config.queries[id].groupId || undefined) === groupId);
      const matching = ids.filter(id => visible(id, group));
      if (filter && !matching.length && !group?.name.toLowerCase().includes(filter)) return;
      const section = this.list.createEl("section", { cls: "kd-group", attr: { "data-group-id": groupId || "" } });
      section.toggleClass("kd-builtin-group", !!builtin);
      if (group || Object.keys(groups).length) {
        const header = section.createDiv("kd-group-header");
        if (group && groupId) {
          header.toggleClass("is-selected", this.selectedGroupId === groupId); header.toggleClass("is-disabled", group.enabled === false || builtin?.rule.enabled === false);
          const grip = header.createEl("button", { cls: "kd-group-grip clickable-icon", attr: { "aria-label": localize("Drag group", "拖动分组") } }); setIcon(grip, "grip-vertical");
          grip.addEventListener("keydown", event => { if (event.altKey && ["ArrowUp", "ArrowDown"].includes(event.key)) { event.preventDefault(); this.moveGroup(groupId, event.key === "ArrowUp" ? -1 : 1); this.headers.get(groupId)?.querySelector<HTMLButtonElement>(".kd-group-grip")?.focus(); } });
          if (builtin) setIcon(header.createSpan({ cls: "kd-builtin-icon", attr: { "aria-hidden": "true" } }), "smile");
          else {
            const fold = header.createEl("button", { cls: "kd-group-fold clickable-icon", attr: { "aria-label": localize("Expand or collapse group", "展开或收起分组"), "aria-expanded": String(!group.collapsed || !!filter) } });
            setIcon(fold, group.collapsed && !filter ? "chevron-right" : "chevron-down");
            fold.addEventListener("click", () => this.toggleGroupCollapsed(groupId));
          }
          const title = header.createEl("button", { cls: "kd-group-title", text: group.name, attr: { "aria-label": localize(`Edit group: ${group.name}`, `编辑分组：${group.name}`) } });
          title.addEventListener("click", event => this.queueGroupSelection(groupId, event));
          if (!builtin) {
            title.addEventListener("dblclick", event => { event.preventDefault(); this.toggleGroupCollapsed(groupId); });
          }
          header.createSpan({ cls: "kd-count", text: builtin ? localize("Built-in", "内置") : String(ids.length) });
          new ToggleComponent(header).setValue(group.enabled !== false && (!builtin || builtin.rule.enabled !== false)).onChange(value => {
            if (builtin) setBuiltinEmojiEnabled(config, groupId, value); else group.enabled = value;
            this.changed(); this.renderList();
            if (builtin && this.selectedGroupId === groupId) this.renderEditor();
          }).toggleEl.setAttribute("aria-label", `${t("enabled")}: ${group.name}`);
          this.headers.set(groupId, header);
        } else header.createSpan({ cls: "kd-group-ungrouped", text: localize("Ungrouped", "未分组") });
      }
      if (builtin) return;
      const items = section.createDiv({ cls: "kd-group-items", attr: { "data-group-id": groupId || "" } });
      const collapsed = !!group?.collapsed && !filter;
      items.toggleClass("is-collapsed", collapsed);
      for (const id of matching) this.renderRow(items, id);
      if (!matching.length && !collapsed && Object.keys(groups).length) items.createDiv({ cls: "kd-group-empty kd-caption", text: localize("Drop rules here", "将规则拖到这里") });
    };
    drawGroup();
    for (const id of repairGroupOrder(config)) drawGroup(id);
    if (!this.rows.size && !Object.keys(groups).length) this.list.createDiv({ cls: "kd-list-empty kd-caption", text: t("noResults") });
    const visibleIds = new Set(this.visibleRuleIds());
    for (const id of this.selectedRuleIds) if (!visibleIds.has(id)) this.selectedRuleIds.delete(id);
    this.updateSelection();
    this.list.scrollTop = scrollTop;
    this.reorderCleanup = attachGroupedReorder(this.list, true, action => this.commitDrop(action), this.app.keymap, id => {
      if (!this.selectedRuleIds.has(id)) {
        this.selectedRuleIds = new Set([id]); this.selectionAnchor = id; this.selectedRuleId = id; this.selectedGroupId = null;
        for (const header of this.headers.values()) header.removeClass("is-selected");
        this.updateSelection(); this.renderEditor();
      }
      return this.visibleRuleIds().filter(key => this.selectedRuleIds.has(key));
    });
  }
  private renderRow(parent: HTMLElement, id: string) {
    const rule = this.plugin.settings.staticHighlighter.queries[id];
    const row = parent.createDiv({ cls: "kd-rule", attr: { "data-id": id, role: "listitem" } });
    const grip = row.createEl("button", { cls: "kd-grip clickable-icon", attr: { "aria-label": t("drag") } }); setIcon(grip, "grip-vertical");
    grip.addEventListener("keydown", event => { if (event.altKey && ["ArrowUp", "ArrowDown"].includes(event.key)) { event.preventDefault(); this.move(id, event.key === "ArrowUp" ? -1 : 1); this.rows.get(id)?.querySelector<HTMLButtonElement>(".kd-grip")?.focus(); } });
    const select = row.createEl("button", { cls: "kd-select" }); select.createDiv("kd-rule-name"); select.createDiv("kd-rule-sample");
    select.addEventListener("click", event => this.selectWithModifiers(id, event));
    new ToggleComponent(row).setValue(rule.enabled !== false).onChange(value => {
      rule.enabled = value; this.changed(); this.updateRow(id);
      if (rule.queryMode === "emoji-shortcodes" && this.selectedRuleId === id) this.renderEditor();
    }).toggleEl.setAttribute("aria-label", `${t("enabled")}: ${ruleLabel(rule)}`);
    this.rows.set(id, row); this.updateRow(id);
  }
  private updateRow(id: string) {
    const config = this.plugin.settings.staticHighlighter, row = this.rows.get(id), rule = config.queries[id];
    if (!row || !rule) return;
    const effective = getEffectiveRule(rule, config.groups);
    row.toggleClass("is-selected", this.selectedRuleIds.has(id)); row.toggleClass("is-disabled", effective.enabled === false);
    const select = row.querySelector<HTMLButtonElement>(".kd-select")!;
    select.setAttribute("aria-pressed", String(this.selectedRuleIds.has(id))); select.querySelector<HTMLElement>(".kd-rule-name")!.setText(ruleLabel(rule));
    const sample = select.querySelector<HTMLElement>(".kd-rule-sample")!;
    sample.addClass(`kd-rule-${id}`.replace(/[^a-zA-Z0-9_-]/g, "-")); renderPreview(sample, this.app, effective);
  }
  private renderEditor() {
    this.editorCleanup?.(); this.editorCleanup = undefined; this.editor.empty();
    const config = this.plugin.settings.staticHighlighter;
    if (this.selectedGroupId && config.groups?.[this.selectedGroupId]) { this.renderGroupEditor(this.selectedGroupId, config.groups[this.selectedGroupId]); return; }
    const rule = this.selectedRuleId && config.queries[this.selectedRuleId];
    if (!rule) {
      const empty = this.editor.createDiv("kd-empty"); setIcon(empty.createDiv("kd-empty-icon"), "whole-word");
      empty.createDiv({ cls: "kd-empty-title", text: t("empty") }); empty.createDiv({ cls: "kd-caption", text: t("emptyDesc") });
      new ButtonComponent(empty).setButtonText(t("newRule")).setCta().onClick(() => this.addRule());
      new ButtonComponent(empty).setButtonText(localize("New group", "新建分组")).onClick(() => this.addGroup()); return;
    }
    this.editorCleanup = renderEditor(this.editor, this.app, rule, {
      changed: () => { this.changed(); if (rule.queryMode === "emoji-shortcodes") this.renderList(); }, back: () => this.collapseEditor(), duplicate: () => this.addRule(rule), remove: () => this.removeRule(), move: delta => this.move(this.selectedRuleId!, delta),
      groupChanged: () => { syncGroupedQueryOrder(config); this.changed(); this.renderList(); this.renderEditor(); }, refresh: () => this.renderEditor(),
    }, { groups: Object.fromEntries(Object.entries(config.groups ?? {}).filter(([id]) => !getBuiltinEmojiGroup(config, id))), groupOrder: repairGroupOrder(config), ruleId: this.selectedRuleId || undefined });
  }
  private renderGroupEditor(id: string, group: RuleGroup) {
    const config = this.plugin.settings.staticHighlighter, builtin = getBuiltinEmojiGroup(config, id);
    const header = this.editor.createDiv("kd-editor-toolbar");
    iconButton(header, "panel-right-close", localize("Collapse settings", "收起设置"), () => this.collapseEditor()).buttonEl.addClass("kd-back");
    const buttons = header.createDiv("kd-actions");
    iconButton(buttons, "folder-output", localize("Export group", "导出分组"), () => new ExportModal(this.app, this.plugin, group.name, config.queries, this.plugin.settings, id).open());
    const order = repairGroupOrder(this.plugin.settings.staticHighlighter), index = order.indexOf(id);
    iconButton(buttons, "arrow-up", t("up"), () => this.moveGroup(id, -1)).setDisabled(index <= 0);
    iconButton(buttons, "arrow-down", t("down"), () => this.moveGroup(id, 1)).setDisabled(index >= order.length - 1);
    if (builtin) {
      renderBuiltinEmojiEditor(this.editor, this.app, builtin.rule, {
        effective: () => getEffectiveRule(builtin.rule, config.groups),
        enabled: () => group.enabled !== false && builtin.rule.enabled !== false,
        setEnabled: enabled => setBuiltinEmojiEnabled(config, id, enabled),
        changed: () => { this.changed(); this.renderList(); },
      });
      return;
    }
    iconButton(buttons, "trash-2", localize("Remove group, keep rules", "删除分组，保留规则"), () => this.removeGroup(id)).buttonEl.addClass("kd-delete");
    const input = new TextComponent(this.editor).setValue(group.name).setPlaceholder(localize("Group name", "分组名称")).onChange(value => { group.name = value; this.changed(); this.renderList(); });
    input.inputEl.addClass("kd-name-input"); input.inputEl.setAttribute("aria-label", localize("Group name", "分组名称"));
    this.editor.createDiv({ cls: "kd-caption kd-group-description", text: localize("Rules inherit unset values from this group. Each rule can override individual values.", "规则未配置的样式会继承这里的设置；每条规则都可以单独覆盖。") });
    const preview = this.editor.createDiv("kd-live-preview kd-preview-area");
    const previewRule = () => ({ query: localize("Group preview", "分组样式预览"), regex: false, ...group.style });
    renderPreview(preview, this.app, previewRule());
    group.style ??= {};
    this.editorCleanup = renderAppearance(this.editor, this.app, group.style, () => { renderPreview(preview, this.app, previewRule()); this.changed(); this.renderList(); });
  }
  private addRule(template?: SearchQuery) {
    const config = this.plugin.settings.staticHighlighter, id = `rule-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const candidateGroup = this.selectedGroupId || (this.selectedRuleId && config.queries[this.selectedRuleId]?.groupId) || undefined;
    const groupId = getBuiltinEmojiGroup(config, candidateGroup) ? undefined : candidateGroup;
    const rule: SearchQuery = template ? { ...structuredClone(template), name: `${ruleLabel(template)} (${t("copy")})` } : { query: "", regex: false, queryMode: "keywords", enabled: true, ...(groupId ? { groupId } : {}) };
    const index = template && this.selectedRuleId ? config.queryOrder.indexOf(this.selectedRuleId) + 1 : config.queryOrder.length;
    config.queries[id] = rule; config.queryOrder.splice(index, 0, id); syncGroupedQueryOrder(config);
    this.selectedRuleId = id; this.selectedGroupId = null; this.filter = ""; this.editing = true; this.editorCollapsed = false;
    this.selectedRuleIds = new Set([id]); this.selectionAnchor = id;
    this.refresh(); this.changed(); this.editor.querySelector<HTMLTextAreaElement>(".kd-query-input")?.focus();
  }
  private addGroup() {
    const config = this.plugin.settings.staticHighlighter; config.groups ??= {};
    const id = `group-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const base = localize("New group", "新分组"); let name = base, index = 2;
    while (Object.values(config.groups).some(group => group.name === name)) name = `${base} ${index++}`;
    config.groups[id] = { name, enabled: true, collapsed: false, style: {} }; config.groupOrder = [...repairGroupOrder(config).filter(key => key !== id), id];
    this.renderList(); this.selectGroup(id); this.changed(); this.editor.querySelector<HTMLInputElement>("input")?.focus();
  }
  private removeRule() {
    const config = this.plugin.settings.staticHighlighter, id = this.selectedRuleId!, rule = config.queries[id], index = config.queryOrder.indexOf(id);
    delete config.queries[id]; config.queryOrder.splice(index, 1); this.selectedRuleId = config.queryOrder[Math.min(index, config.queryOrder.length - 1)] || null;
    this.selectedRuleIds = new Set(this.selectedRuleId ? [this.selectedRuleId] : []); this.selectionAnchor = this.selectedRuleId;
    this.refresh(); this.changed(); this.undoNotice(t("deleted"), () => { config.queries[id] = rule; config.queryOrder.splice(Math.min(index, config.queryOrder.length), 0, id); syncGroupedQueryOrder(config); this.renderList(); this.selectRule(id); this.changed(); });
  }
  private removeGroup(id: string) {
    const config = this.plugin.settings.staticHighlighter, group = config.groups?.[id]; if (!group) return;
    const order = config.queryOrder.slice(), groupOrder = repairGroupOrder(config).slice();
    const originals = Object.fromEntries(Object.entries(config.queries).filter(([, rule]) => rule.groupId === id).map(([key, rule]) => [key, structuredClone(rule)]));
    for (const key of Object.keys(originals)) {
      const rule = config.queries[key], effective = getEffectiveRule(rule, config.groups);
      for (const field of appearanceKeys) if (rule[field] === undefined && effective[field] !== undefined) Object.assign(rule, { [field]: effective[field] });
      delete rule.groupId;
    }
    delete config.groups![id]; config.groupOrder = groupOrder.filter(key => key !== id); syncGroupedQueryOrder(config);
    this.selectedGroupId = null; this.selectedRuleId = config.queryOrder[0] || null;
    this.selectedRuleIds = new Set(this.selectedRuleId ? [this.selectedRuleId] : []); this.selectionAnchor = this.selectedRuleId;
    this.refresh(); this.changed();
    this.undoNotice(localize("Group removed; rules kept.", "分组已删除，规则已保留。"), () => { config.groups ??= {}; config.groups[id] = group; config.groupOrder = groupOrder; for (const [key, rule] of Object.entries(originals)) if (config.queries[key]) config.queries[key] = rule; config.queryOrder = order.filter(key => !!config.queries[key]); for (const key of Object.keys(config.queries)) if (!config.queryOrder.includes(key)) config.queryOrder.push(key); this.renderList(); this.selectGroup(id); this.changed(); });
  }
  private undoNotice(text: string, undoAction: () => void) {
    const doc = this.list.ownerDocument, fragment = doc.adoptNode(createFragment()); fragment.appendChild(doc.createTextNode(text + " "));
    const undo = doc.adoptNode(createEl("button")); undo.textContent = t("undo"); fragment.appendChild(undo);
    const notice = new Notice(fragment, 8000); undo.addEventListener("click", () => { undoAction(); notice.hide(); });
  }
  private move(id: string, delta: number) {
    const config = this.plugin.settings.staticHighlighter, rule = config.queries[id]; if (!rule) return;
    const members = config.queryOrder.filter(key => config.queries[key]?.groupId === rule.groupId), index = members.indexOf(id), target = index + delta;
    if (target < 0 || target >= members.length) return;
    if (moveRuleToGroup(config, id, rule.groupId, members[delta > 0 ? target + 1 : target])) { this.changed(); this.renderList(); this.revealListItem(this.rows.get(id)); }
  }
  private moveGroup(id: string, delta: number) {
    const config = this.plugin.settings.staticHighlighter, order = repairGroupOrder(config), index = order.indexOf(id), target = index + delta;
    if (target < 0 || target >= order.length) return;
    if (moveRuleGroup(config, id, order[delta > 0 ? target + 1 : target])) { this.changed(); this.renderList(); if (this.selectedGroupId) this.renderEditor(); this.revealListItem(this.headers.get(id)); }
  }
  private commitDrop(action: GroupedReorderAction) {
    const config = this.plugin.settings.staticHighlighter;
    if (action.type === "rule" && getBuiltinEmojiGroup(config, action.groupId)) return;
    const changed = action.type === "group" ? moveRuleGroup(config, action.id, action.beforeGroupId) : moveRulesToGroup(config, action.ids ?? [action.id], action.groupId, action.beforeId);
    if (!changed) return;
    if (action.type === "rule" && action.groupId && config.groups?.[action.groupId]) config.groups[action.groupId].collapsed = false;
    this.changed(); this.renderList(); this.renderEditor();
    this.revealListItem(action.type === "group" ? this.headers.get(action.id) : this.rows.get(action.id));
  }
  private bulkAdd() {
    const config = this.plugin.settings.staticHighlighter, template = this.selectedRuleId ? getEffectiveRule(config.queries[this.selectedRuleId], config.groups) : undefined;
    new BulkAddModal(this.app, (rules, order, groups, groupOrder) => {
      const previous = new Set(Object.keys(this.plugin.settings.staticHighlighter.queries));
      this.plugin.settings = appendBulkRules(this.plugin.settings, rules, order, groups, groupOrder);
      this.selectedRuleId = this.plugin.settings.staticHighlighter.queryOrder.find(id => !previous.has(id)) || this.selectedRuleId;
      this.selectedRuleIds = new Set(this.selectedRuleId ? [this.selectedRuleId] : []); this.selectionAnchor = this.selectedRuleId;
      this.selectedGroupId = null; this.editing = true; this.editorCollapsed = false; this.refresh(); this.changed();
    }, template, config.queryOrder).open();
  }
}

class DecorationRulesPage extends SettingPage {
  title = localize("Decoration rules", "装饰规则");
  constructor(private readonly tab: SettingTab) { super(); }
  display(): void { this.tab.renderRulesInto(this.containerEl, this); }
  hide(): void { this.tab.closeRulesPage(this); }
}
