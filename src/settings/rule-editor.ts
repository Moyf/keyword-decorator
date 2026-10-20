import { App, TextAreaComponent, TextComponent } from "obsidian";
import { localize, t } from "../i18n";
import { MAX_REGEX_PATTERN_LENGTH } from "../highlighters/matching";
import { QueryMode, RuleGroup, SearchQuery } from "./settings";
import { clearRuleAppearance, getEffectiveRule } from "./groups";
import { field, iconButton, renderPreview } from "./ui-helpers";
import { renderAppearance } from "./appearance-editor";

interface EditorActions {
  changed: () => void; back: () => void; duplicate: () => void; remove: () => void; move: (delta: number) => void;
  groupChanged?: () => void; refresh?: () => void;
}
interface EditorContext { groups?: Record<string, RuleGroup>; groupOrder?: string[]; ruleId?: string }

export function renderEditor(container: HTMLElement, app: App, rule: SearchQuery, actions: EditorActions, context: EditorContext = {}): () => void {
  const effective = () => getEffectiveRule(rule, context.groups);
  const header = container.createDiv("kd-editor-toolbar");
  iconButton(header, "panel-right-close", localize("Collapse settings", "收起设置"), actions.back).buttonEl.addClass("kd-back");
  header.createSpan({ cls: "kd-caption", text: t("name") });
  const buttons = header.createDiv("kd-actions");
  iconButton(buttons, "arrow-up", t("up"), () => actions.move(-1));
  iconButton(buttons, "arrow-down", t("down"), () => actions.move(1));
  iconButton(buttons, "copy-plus", t("duplicate"), actions.duplicate);
  iconButton(buttons, "trash-2", t("delete"), actions.remove).buttonEl.addClass("kd-delete");
  const name = new TextComponent(container).setPlaceholder(t("namePlaceholder")).setValue(rule.name || "").onChange(value => {
    rule.name = value; actions.changed();
  });
  name.inputEl.addClass("kd-name-input"); name.inputEl.setAttribute("aria-label", t("name"));
  const groupField = field(container, localize("Group", "所属分组"));
  const group = groupField.wrap.createEl("select", { cls: "kd-group-select", attr: { id: groupField.id } });
  group.createEl("option", { value: "", text: localize("Ungrouped", "未分组") });
  const groupIds = [...new Set([...(context.groupOrder || []), ...Object.keys(context.groups || {})])];
  for (const id of groupIds) if (context.groups?.[id]) group.createEl("option", { value: id, text: context.groups[id].name });
  group.value = rule.groupId || "";
  group.addEventListener("change", () => {
    if (group.value) rule.groupId = group.value; else delete rule.groupId;
    if (actions.groupChanged) actions.groupChanged(); else actions.changed();
  });
  if (rule.groupId && context.groups?.[rule.groupId]) {
    const inheritance = container.createDiv("kd-inherit-info");
    inheritance.createDiv({ cls: "kd-caption", text: localize("Unset values inherit the group. Your own values override it; ↶ restores a group value.", "未设置的项目继承分组；单独配置的值会覆盖分组，↶ 可恢复继承。") });
    iconButton(inheritance, "rotate-ccw", localize("Reset appearance to group", "全部外观恢复为继承分组"), () => {
      clearRuleAppearance(rule); actions.changed(); actions.refresh?.();
    });
  }
  const previewArea = container.createDiv("kd-preview-area");
  previewArea.createSpan({ cls: "kd-eyebrow", text: t("preview") });
  const preview = previewArea.createDiv("kd-live-preview");
  if (context.ruleId) preview.addClass(`kd-rule-${context.ruleId}`.replace(/[^a-zA-Z0-9_-]/g, "-"));
  const change = () => { renderPreview(preview, app, effective()); actions.changed(); };
  renderPreview(preview, app, effective());
  const match = container.createDiv("kd-section");
  match.createDiv({ cls: "kd-section-heading", text: t("matching") });
  const modeField = field(match, t("mode")), mode = modeField.wrap.createEl("select", { attr: { id: modeField.id } });
  for (const value of ["keywords", "regex"] as const) mode.createEl("option", { value, text: t(value) });
  mode.value = rule.queryMode === "regex" || rule.regex ? "regex" : "keywords";
  const queryField = field(match, t("query"));
  const visibleQuery = rule.queryMode === "multiple" ? rule.query.split(/[\n,]/).map(value => value.trim()).filter(Boolean).join("\n") : rule.query;
  const query = new TextAreaComponent(queryField.wrap).setValue(visibleQuery).onChange(value => {
    rule.query = value; rule.queryMode = mode.value as QueryMode; rule.regex = mode.value === "regex"; validate(); change();
  });
  query.inputEl.id = queryField.id; query.inputEl.rows = 2; query.inputEl.spellcheck = false;
  const hint = queryField.wrap.createDiv("kd-caption"), error = queryField.wrap.createDiv({ cls: "kd-error", attr: { role: "status" } });
  function validate() {
    let valid = true;
    if (mode.value === "regex" && rule.query) { try { new RegExp(rule.query, "m"); } catch { valid = false; } }
    const tooLong = mode.value === "regex" && rule.query.length > MAX_REGEX_PATTERN_LENGTH;
    error.setText(tooLong ? localize(`Patterns are limited to ${MAX_REGEX_PATTERN_LENGTH} characters.`, `正则表达式最多 ${MAX_REGEX_PATTERN_LENGTH} 个字符。`) : valid ? "" : t("invalidRegex"));
    query.inputEl.setAttribute("aria-invalid", String(!valid || tooLong));
    hint.setText(mode.value === "regex" ? localize("Enter a pattern without / delimiters. ^ and $ match the start and end of each line.", "填写表达式，不包含两侧的 /；^ 和 $ 分别匹配每行的开头和结尾。") : t("queryHint"));
  }
  mode.addEventListener("change", () => { rule.query = query.getValue(); rule.queryMode = mode.value as QueryMode; rule.regex = mode.value === "regex"; validate(); change(); });
  validate();
  return renderAppearance(container, app, rule, change, { effective, inherited: !!rule.groupId && !!context.groups?.[rule.groupId], refresh: actions.refresh });
}
