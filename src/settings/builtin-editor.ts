import { App, ToggleComponent } from "obsidian";
import { localize, t } from "../i18n";
import type { SearchQuery } from "./settings";
import { lookupEmojiShortcode } from "../emoji/shortcodes";

const EMOJI_PREVIEW_SAMPLES = [":smile:", ":tada:", ":fire:", ":heart:", ":100:"];

interface BuiltinActions {
  effective: () => SearchQuery;
  enabled: () => boolean;
  setEnabled: (enabled: boolean) => void;
  changed: () => void;
}

/** Built-in conversions have their own controls, separate from ordinary match types. */
export function renderBuiltinEmojiEditor(container: HTMLElement, _app: App, rule: SearchQuery, actions: BuiltinActions): void {
  container.createDiv({ cls: "kd-section-heading", text: "Emoji shortcodes" });
  container.createDiv({ cls: "kd-caption", text: localize(
    "Display :smile:, :heart: and :happy: as system emoji. Includes 1,914 offline aliases; unknown names stay unchanged.",
    "将 :smile:、:heart:、:happy: 等短码显示为系统 Emoji。内置 1,914 个离线别名，未知名称保留原样。",
  ) });
  const preview = container.createDiv("kd-live-preview kd-preview-area kd-emoji-preview");
  const refresh = () => {
    preview.empty();
    const effective = actions.effective();
    preview.style.setProperty("--kd-text", effective.textColor || "var(--text-normal)");
    preview.style.setProperty("--kd-bg", effective.color || "transparent");
    preview.style.setProperty("--kd-weight", effective.fontWeight || "inherit");
    preview.style.setProperty("--kd-style", effective.italic ? "italic" : "normal");
    preview.style.setProperty("--kd-decoration", effective.underline ? "underline" : "none");
    for (const shortcode of EMOJI_PREVIEW_SAMPLES) {
      const item = preview.createSpan({ cls: "kd-preview kd-emoji-sample", attr: { "aria-label": shortcode } });
      const emoji = lookupEmojiShortcode(shortcode);
      if (emoji) item.createSpan({ cls: "kd-emoji-glyph", text: emoji });
      if (effective.hideText !== true || !emoji) item.createSpan({ cls: "kd-preview-text", text: shortcode });
    }
  };
  refresh();
  const toggle = (label: string, description: string, value: boolean, changed: (enabled: boolean) => void) => {
    const row = container.createDiv("kd-option-row"), info = row.createDiv("kd-option-info");
    info.createDiv({ cls: "kd-option-title", text: label });
    info.createDiv({ cls: "kd-caption", text: description });
    new ToggleComponent(row).setValue(value).onChange(enabled => {
      changed(enabled); refresh(); actions.changed();
    }).toggleEl.setAttribute("aria-label", label);
  };
  toggle(localize("Enable conversion", "启用转换"), localize("Display :shortcodes: as emoji.", "将 :shortcodes: 显示为 Emoji。"), actions.enabled(), actions.setEnabled);
  toggle(t("hideText"), localize("Show only emoji. Move the cursor into a match to edit its shortcode.", "仅显示 Emoji；光标移入时显示短码原文。"), actions.effective().hideText === true, enabled => { rule.hideText = enabled; });
}
