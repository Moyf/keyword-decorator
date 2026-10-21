import { App, ButtonComponent, getIcon, setIcon, TextAreaComponent, TextComponent, ToggleComponent } from "obsidian";
import { localize, t } from "../i18n";
import { isSvgMarkupValid, normalizeImageUrl } from "../markers";
import { PrefixType, RuleAppearance } from "./settings";
import { colorControl, field, iconButton } from "./ui-helpers";
import { ImagePicker, ImageSuggest } from "./image-picker";
import { IconPicker, IconSuggest } from "./icon-picker";

export const CUSTOM_CSS_EXAMPLE = "& {\n  border-bottom: 2px dashed currentColor;\n  border-radius: 4px;\n  padding: 0 4px;\n}";

interface AppearanceContext {
  effective?: () => RuleAppearance;
  inherited?: boolean;
  refresh?: () => void;
}

export function renderAppearance(container: HTMLElement, app: App, style: RuleAppearance, onChanged: () => void, context: AppearanceContext = {}): () => void {
  const effective = () => context.effective?.() || style;
  const resetUpdates: (() => void)[] = [];
  const visibilityUpdates: (() => void)[] = [];
  const changed = () => { resetUpdates.forEach(update => update()); visibilityUpdates.forEach(update => update()); onChanged(); };
  let imageSuggest: ImageSuggest | undefined, iconSuggest: IconSuggest | undefined;
  const reset = (wrap: HTMLElement, keys: (keyof RuleAppearance)[]) => {
    if (!context.inherited) return;
    wrap.addClass("has-inherit-reset");
    const button = iconButton(wrap, "rotate-ccw", localize("Use group value", "使用分组的值"), () => {
      for (const key of keys) delete style[key];
      changed(); context.refresh?.();
    });
    button.buttonEl.addClass("kd-inherit-reset");
    const update = () => { const own = keys.some(key => style[key] !== undefined); wrap.toggleClass("is-inherited", !own); button.setDisabled(!own); };
    resetUpdates.push(update); update();
  };
  const toggle = (parent: HTMLElement, key: "iconInheritColor" | "backgroundIncludesMarker" | "hideText" | "styleWholeLine", label: string, description: string, fallback = false) => {
    const row = parent.createDiv("kd-option-row"), info = row.createDiv("kd-option-info");
    info.createDiv({ cls: "kd-option-title", text: label });
    if (description) info.createDiv({ cls: "kd-caption", text: description });
    const component = new ToggleComponent(row).setValue(effective()[key] ?? fallback).onChange(value => { style[key] = value; changed(); });
    component.toggleEl.setAttribute("aria-label", label); reset(row, [key]);
    return row;
  };
  const appearance = section(container, t("appearance"));
  const colors = appearance.createDiv("kd-color-grid");
  reset(colorControl(colors, t("textColor"), effective().textColor, "#d7993c", value => { style.textColor = value; changed(); }), ["textColor"]);
  reset(colorControl(colors, t("background"), effective().color, "#ffe099", value => { style.color = value; changed(); }), ["color"]);
  const backgroundMarkerRow = toggle(appearance, "backgroundIncludesMarker", localize("Include marker in background", "背景包含前缀标记"), localize("Extend the background color to the icon, emoji or image.", "背景颜色同时覆盖图标、Emoji 或图片所在的位置。"));
  const updateBackgroundVisibility = () => backgroundMarkerRow.toggleClass("is-hidden", !effective().color);
  visibilityUpdates.push(updateBackgroundVisibility); updateBackgroundVisibility();
  const formats = appearance.createDiv("kd-formats");
  for (const [key, icon] of [["bold", "bold"], ["italic", "italic"], ["underline", "underline"]] as const) {
    const enabled = () => key === "bold" ? effective().fontWeight === "700" : Boolean(effective()[key]);
    const button = new ButtonComponent(formats).setIcon(icon).setTooltip(t(key)).onClick(() => {
      const value = !enabled(); if (key === "bold") style.fontWeight = value ? "700" : ""; else style[key] = value;
      button.buttonEl.setAttribute("aria-pressed", String(value)); changed();
    });
    button.buttonEl.setAttribute("aria-pressed", String(enabled()));
  }
  reset(formats, ["fontWeight", "italic", "underline"]);

  const marker = section(container, t("marker"));
  const typeField = field(marker, t("markerType")), type = typeField.wrap.createEl("select", { attr: { id: typeField.id } });
  for (const value of ["none", "emoji", "icon", "image", "url", "svg"] as const) type.createEl("option", { value, text: t(value) });
  const initial = effective();
  let currentType: PrefixType = initial.prefixType === "image" && /^https?:/i.test(initial.prefixValue || "") ? "url" : initial.prefixType || "none";
  type.value = currentType;
  reset(typeField.wrap, ["prefixType", "prefixValue", "prefixValues"]);
  const source = marker.createDiv("kd-marker-source");
  const hideRow = toggle(marker, "hideText", t("hideText"), t("hideDesc"));
  const inheritColorRow = toggle(marker, "iconInheritColor", localize("Use text color for icon", "图标继承文字颜色"), localize("Use this rule's text color for its Lucide icon.", "Lucide 图标使用此规则的文字颜色。"), true);
  const remember = (value: string) => {
    style.prefixType = currentType; style.prefixValue = value;
    style.prefixValues = { ...effective().prefixValues, ...style.prefixValues, [currentType]: value };
  };
  function markerFields() {
    imageSuggest?.close(); imageSuggest = undefined; iconSuggest?.destroy(); iconSuggest = undefined; source.empty();
    const imageType = ["image", "url", "svg"].includes(currentType);
    hideRow.toggleClass("is-hidden", !imageType && currentType !== "emoji"); inheritColorRow.toggleClass("is-hidden", currentType !== "icon");
    if (currentType === "none") return;
    const valueField = field(source, currentType === "svg" ? t("svg") : currentType === "icon" ? localize("Icon", "图标") : t("markerValue"));
    const error = valueField.wrap.createDiv({ cls: "kd-error", attr: { role: "status" } });
    const validate = (value: string) => {
      let valid = true;
      if (currentType === "svg") valid = !value.trim() || isSvgMarkupValid(container.ownerDocument, value);
      if (currentType === "url") valid = !value.trim() || Boolean(normalizeImageUrl(value));
      if (currentType === "icon") valid = !value.trim() || !!getIcon(value.trim());
      error.setText(valid ? "" : currentType === "url" ? t("invalidUrl") : currentType === "icon"
        ? localize("Choose an icon from the suggestions.", "请从建议列表中选择有效图标。")
        : localize("Enter a complete, valid SVG element.", "请填写完整、有效的 SVG 元素。"));
      return valid;
    };
    const value = effective().prefixValue || "";
    if (currentType === "svg") {
      const input = new TextAreaComponent(valueField.wrap).setValue(value).setPlaceholder('<svg viewBox="0 0 24 24">…</svg>').onChange(value => {
        remember(value); input.inputEl.setAttribute("aria-invalid", String(!validate(value))); changed();
      });
      input.inputEl.id = valueField.id; input.inputEl.addClass("kd-code"); input.inputEl.spellcheck = false;
      input.inputEl.setAttribute("aria-invalid", String(!validate(value))); valueField.wrap.createDiv({ cls: "kd-caption", text: t("svgHint") });
    } else {
      const row = valueField.wrap.createDiv("kd-image-input-row");
      const placeholder = currentType === "url" ? "https://example.com/image.png" : currentType === "image" ? "assets/image.svg" : currentType === "icon" ? localize("Search icons…", "搜索图标…") : "✨";
      const input = new TextComponent(row).setValue(value).setPlaceholder(placeholder).onChange(value => {
        remember(value); input.inputEl.setAttribute("aria-invalid", String(!validate(value))); changed();
      });
      input.inputEl.id = valueField.id; input.inputEl.spellcheck = false; input.inputEl.setAttribute("aria-invalid", String(!validate(value)));
      if (currentType === "url") { input.inputEl.type = "url"; valueField.wrap.createDiv({ cls: "kd-caption", text: t("urlHint") }); }
      if (currentType === "image") {
        imageSuggest = new ImageSuggest(app, input.inputEl);
        iconButton(row, "image-plus", t("browse"), () => new ImagePicker(app, file => { input.setValue(file.path); remember(file.path); changed(); }).open());
        valueField.wrap.createDiv({ cls: "kd-caption", text: t("imageHint") });
      }
      if (currentType === "icon") {
        iconSuggest = new IconSuggest(app, input.inputEl);
        iconButton(row, "shapes", localize("Browse icons", "浏览图标"), () => new IconPicker(app, id => { input.setValue(id); remember(id); input.inputEl.setAttribute("aria-invalid", "false"); changed(); }).open());
      }
    }
    if (imageType) {
      const dimensions = source.createDiv("kd-dimensions");
      for (const [key, label] of [["imageWidth", "width"], ["imageHeight", "height"]] as const) {
        const sizeField = field(dimensions, t(label));
        const input = sizeField.wrap.createEl("input", { type: "number", value: String(effective()[key] || 24), attr: { id: sizeField.id, min: "1", max: "512", step: "1" } });
        input.addEventListener("input", () => {
          const number = Number(input.value), valid = Number.isInteger(number) && number >= 1 && number <= 512;
          input.setAttribute("aria-invalid", String(!valid)); if (valid) { style[key] = number; changed(); }
        });
        reset(sizeField.wrap, [key]);
      }
      source.createDiv({ cls: "kd-caption", text: t("sizeHint") });
    }
  }
  type.addEventListener("change", () => {
    const values = { ...effective().prefixValues, ...style.prefixValues };
    if (currentType !== "none") values[currentType] = effective().prefixValue || "";
    currentType = type.value as PrefixType;
    style.prefixType = currentType; style.prefixValues = values;
    style.prefixValue = values[currentType] ?? (currentType === "emoji" ? "✨" : currentType === "icon" ? "sparkles" : "");
    markerFields(); changed();
  });
  markerFields();
  const advanced = container.createEl("details", { cls: "kd-advanced" });
  const summary = advanced.createEl("summary", { cls: "kd-advanced-summary" });
  const symbol = summary.createSpan({ cls: "kd-advanced-symbol", attr: { "aria-hidden": "true" } });
  // Use the same host icon helper as the rest of the editor.
  setIcon(symbol, "sliders-horizontal");
  const label = summary.createDiv("kd-advanced-label");
  label.createSpan({ cls: "kd-advanced-title", text: t("advanced") });
  label.createDiv({ cls: "kd-caption", text: localize("Line styles and custom CSS", "整行样式与自定义 CSS") });
  setIcon(summary.createSpan({ cls: "kd-disclosure-icon", attr: { "aria-hidden": "true" } }), "chevron-down");
  const body = advanced.createDiv("kd-advanced-body");
  toggle(body, "styleWholeLine", localize("Apply style to the whole line", "把样式附加到整行"), localize("Style the complete logical line containing a match.", "将样式应用到关键词所在的整个逻辑行。"));
  const classes = field(body, t("cssClass"));
  new TextComponent(classes.wrap).setValue(effective().class || "").setPlaceholder("Keyword-style").onChange(value => { style.class = value.trim(); changed(); }).inputEl.id = classes.id;
  reset(classes.wrap, ["class"]);
  const css = field(body, t("css"));
  const cssInput = new TextAreaComponent(css.wrap).setValue(effective().css || "").setPlaceholder(CUSTOM_CSS_EXAMPLE).onChange(value => { style.css = value; changed(); });
  cssInput.inputEl.addClass("kd-code"); cssInput.inputEl.id = css.id; cssInput.inputEl.spellcheck = false; reset(css.wrap, ["css"]);
  css.wrap.createDiv({ cls: "kd-caption", text: localize("& targets this rule's match, or its whole line when enabled above.", "& 表示当前规则的匹配内容；开启整行样式后表示所在整行。") });
  return () => { imageSuggest?.close(); iconSuggest?.destroy(); };
}

function section(parent: HTMLElement, label: string) {
  const el = parent.createDiv("kd-section"); el.createDiv({ cls: "kd-section-heading", text: label }); return el;
}
