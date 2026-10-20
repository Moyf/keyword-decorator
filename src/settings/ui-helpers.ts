import { App, ButtonComponent } from "obsidian";
import { t } from "../i18n";
import { createPrefixNode } from "../markers";
import { SearchQuery } from "./settings";

let fieldId = 0;
export function field(parent: HTMLElement, text: string) {
  const wrap = parent.createDiv("kd-field"), id = `kd-field-${++fieldId}`;
  wrap.createEl("label", { text, attr: { for: id } });
  return { wrap, id };
}
export function iconButton(parent: HTMLElement, icon: string, label: string, action: () => void) {
  return new ButtonComponent(parent).setIcon(icon).setTooltip(label).onClick(action);
}
export function ruleLabel(rule: SearchQuery) { return rule.name?.trim() || rule.query.trim().split(/[\n,]/)[0] || t("unnamed"); }
export function sampleText(rule: SearchQuery) {
  const value = rule.query.trim();
  if (rule.queryMode === "regex" || rule.regex) return value ? `/${value}/` : t("previewText");
  return value.split(rule.queryMode === "multiple" ? /[\n,]/ : /\r?\n/)[0] || t("previewText");
}
export function renderPreview(el: HTMLElement, app: App, rule: SearchQuery, text = sampleText(rule)) {
  el.empty(); el.addClass("kd-preview");
  el.setCssProps({
    "--kd-text": rule.textColor || "var(--text-normal)", "--kd-bg": rule.color || "transparent",
    "--kd-weight": rule.fontWeight || "inherit", "--kd-style": rule.italic ? "italic" : "normal",
    "--kd-decoration": rule.underline ? "underline" : "none",
  });
  const prefix = createPrefixNode(app, el.ownerDocument, rule);
  if (prefix) el.appendChild(prefix);
  const hide = Boolean(rule.hideText && prefix?.dataset.kdImageValid === "true" && ["image", "url", "svg"].includes(rule.prefixType || ""));
  if (!hide) el.createSpan({ cls: "kd-preview-text", text });
  el.setAttribute("aria-label", text);
}

export function colorControl(parent: HTMLElement, label: string, value: string | null | undefined, fallback: string, changed: (value: string | null) => void) {
  const { wrap, id } = field(parent, label); wrap.addClass("kd-color-field");
  const row = wrap.createDiv("kd-color-controls");
  const enabled = row.createEl("input", { type: "checkbox", attr: { "aria-label": label, id } });
  enabled.checked = Boolean(value);
  const picker = row.createEl("input", { type: "color", attr: { "aria-label": label } });
  picker.value = /^#[0-9a-f]{6,8}$/i.test(value || "") ? value!.slice(0, 7) : fallback;
  const input = row.createEl("input", { type: "text", attr: { "aria-label": label, placeholder: fallback, spellcheck: "false" } });
  input.value = value || "";
  function state() { picker.disabled = !enabled.checked; input.disabled = !enabled.checked; }
  enabled.addEventListener("change", () => { state(); changed(enabled.checked ? input.value || picker.value : null); });
  picker.addEventListener("input", () => { input.value = picker.value; changed(picker.value); });
  input.addEventListener("input", () => {
    const valid = /^(#[\da-f]{3,4}|#[\da-f]{6}|#[\da-f]{8})$/i.test(input.value.trim());
    input.setAttribute("aria-invalid", String(!valid));
    if (valid) { changed(input.value.trim()); if (input.value.length >= 7) picker.value = input.value.slice(0, 7); }
  });
  state();
  return wrap;
}
