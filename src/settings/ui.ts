import {
  App,
  ButtonComponent,
  FuzzySuggestModal,
  Notice,
  PluginSettingTab,
  setIcon,
  Setting,
  TextAreaComponent,
  TextComponent,
  TFile,
} from "obsidian";
import DynamicHighlightsPlugin from "../main";
import { ExportModal } from "./export";
import { ImportModal } from "./import";
import { PrefixType } from "./settings";

type QueryMode = "single" | "multiple" | "regex";

export class SettingTab extends PluginSettingTab {
  plugin: DynamicHighlightsPlugin;
  selectedRuleId: string | null = null;

  constructor(app: App, plugin: DynamicHighlightsPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  hide() {}

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("dynamic-highlights-settings", "keyword-decorator-settings");

    const header = containerEl.createDiv("keyword-decorator-settings-header");
    header.createEl("h3", { text: "Keyword Decorator" });
    const actions = header.createDiv("keyword-decorator-settings-actions");
    actions.createEl("a", { text: "Import", href: "#" }, el => {
      el.addEventListener("click", e => {
        e.preventDefault();
        new ImportModal(this.plugin.app, this.plugin).open();
      });
    });
    actions.createEl("a", { text: "Export", href: "#" }, el => {
      el.addEventListener("click", e => {
        e.preventDefault();
        new ExportModal(this.plugin.app, this.plugin, "All", this.plugin.settings.staticHighlighter.queries).open();
      });
    });

    const layout = containerEl.createDiv("keyword-decorator-layout");
    const listPanel = layout.createDiv("keyword-decorator-rules");
    const editorPanel = layout.createDiv("keyword-decorator-editor");

    this.renderRuleList(listPanel);
    this.renderRuleEditor(editorPanel);
  }

  renderRuleList(container: HTMLElement) {
    container.empty();
    container.createEl("h4", { text: "Rules" });
    new ButtonComponent(container)
      .setButtonText("+ New rule")
      .setCta()
      .onClick(async () => {
        const config = this.plugin.settings.staticHighlighter;
        const newRuleId = generateRuleId(config.queryOrder);
        config.queryOrder.unshift(newRuleId);
        config.queries[newRuleId] = {
          query: "",
          queryMode: "single",
          regex: false,
          textColor: "#f0a742",
          color: null,
          fontWeight: "700",
          italic: false,
          underline: false,
          prefixType: "emoji",
          prefixValue: "✨",
          enabled: true,
        };
        this.selectedRuleId = newRuleId;
        await this.plugin.saveSettings();
        this.plugin.updateStaticHighlighter();
        this.plugin.updateStyles();
        this.plugin.updateCustomCSS();
        this.display();
      });

    const list = container.createDiv("keyword-decorator-rule-list");
    const config = this.plugin.settings.staticHighlighter;
    if (!this.selectedRuleId && config.queryOrder.length > 0) {
      this.selectedRuleId = config.queryOrder[0];
    }

    config.queryOrder.forEach(ruleId => {
      const rule = config.queries[ruleId];
      if (!rule) return;
      const item = list.createDiv("keyword-decorator-rule-item");
      if (this.selectedRuleId === ruleId) item.addClass("is-active");

      const title = item.createDiv("keyword-decorator-rule-title");
      const listPreviewText = previewRuleName(rule.query || "", rule.queryMode || inferMode(rule));
      title.setText(rule.name || listPreviewText);

      const preview = item.createDiv("keyword-decorator-rule-preview");
      applyRulePreview(preview, this.app, rule, listPreviewText);

      const meta = item.createDiv("keyword-decorator-rule-meta");
      meta.setText(`mode: ${rule.queryMode || inferMode(rule)}${rule.prefixType ? ` | prefix: ${rule.prefixType}` : ""}`);

      item.addEventListener("click", () => {
        this.selectedRuleId = ruleId;
        this.display();
      });
    });
  }

  renderRuleEditor(container: HTMLElement) {
    container.empty();
    const app = this.app;
    const config = this.plugin.settings.staticHighlighter;
    const editingRule = this.selectedRuleId ? config.queries[this.selectedRuleId] : null;
    const mode: QueryMode = editingRule?.queryMode || inferMode(editingRule) || "single";
    const prefixType: PrefixType = editingRule?.prefixType || "emoji";

    container.createEl("h4", { text: this.selectedRuleId ? "Edit rule" : "Create rule" });

    const ruleNameWrap = container.createDiv("keyword-decorator-field");
    ruleNameWrap.createEl("label", { text: "Rule name" });
    const ruleNameInput = new TextComponent(ruleNameWrap);
    ruleNameInput.setPlaceholder("Rule name (optional)");
    ruleNameInput.setValue(editingRule?.name || "");

    const livePreview = container.createDiv("keyword-decorator-live-preview");

    const modeWrap = container.createDiv("keyword-decorator-field");
    const modeHeader = modeWrap.createDiv("keyword-decorator-inline-header");
    modeHeader.createEl("label", { text: "Keyword mode" });
    const modeSelect = modeHeader.createEl("select");
    addOption(modeSelect, "single", "Single keyword");
    addOption(modeSelect, "multiple", "Multiple keywords");
    addOption(modeSelect, "regex", "Regular expression");
    modeSelect.value = mode;

    const queryWrap = container.createDiv("keyword-decorator-field");
    queryWrap.createEl("label", { text: "Keywords" });
    const queryInput = new TextComponent(queryWrap);
    const queryTextarea = new TextAreaComponent(queryWrap);
    const initialQuery = editingRule?.query || "";
    queryInput.setValue(initialQuery);
    queryTextarea.setValue(initialQuery);
    updateQueryInputByMode(modeSelect.value as QueryMode, queryInput, queryTextarea);
    modeSelect.addEventListener("change", () => {
      updateQueryInputByMode(modeSelect.value as QueryMode, queryInput, queryTextarea);
    });

    const textColorWrap = container.createDiv("keyword-decorator-field keyword-decorator-bg-row");
    textColorWrap.createEl("label", { text: "Text color" });
    const textColorEnabled = textColorWrap.createEl("input", { type: "checkbox" });
    textColorEnabled.checked = editingRule ? Boolean(editingRule.textColor) : true;
    const textColorHex = textColorWrap.createEl("input", { type: "text" });
    textColorHex.addClass("keyword-decorator-color-hex");
    textColorHex.value = normalizeColor(editingRule?.textColor, "#f0a742").toUpperCase();
    const textColorInput = textColorWrap.createEl("input", { type: "color" });
    textColorInput.value = normalizeColor(editingRule?.textColor, "#f0a742");
    textColorInput.disabled = !textColorEnabled.checked;
    toggleColorPickerVisibility(textColorEnabled, textColorInput);
    toggleColorPickerVisibility(textColorEnabled, textColorHex);
    syncColorControls(textColorHex, textColorInput, "#f0a742", refreshPreview);
    textColorEnabled.addEventListener("change", () => {
      textColorInput.disabled = !textColorEnabled.checked;
      toggleColorPickerVisibility(textColorEnabled, textColorInput);
      toggleColorPickerVisibility(textColorEnabled, textColorHex);
      refreshPreview();
    });

    const bgWrap = container.createDiv("keyword-decorator-field keyword-decorator-bg-row");
    bgWrap.createEl("label", { text: "Background color" });
    const bgEnabled = bgWrap.createEl("input", { type: "checkbox" });
    bgEnabled.checked = Boolean(editingRule?.color);
    const bgColorHex = bgWrap.createEl("input", { type: "text" });
    bgColorHex.addClass("keyword-decorator-color-hex");
    bgColorHex.value = normalizeColor(editingRule?.color, "#ffd54f").toUpperCase();
    const bgColorInput = bgWrap.createEl("input", { type: "color" });
    bgColorInput.value = normalizeColor(editingRule?.color, "#ffd54f");
    bgColorInput.disabled = !bgEnabled.checked;
    toggleColorPickerVisibility(bgEnabled, bgColorInput);
    toggleColorPickerVisibility(bgEnabled, bgColorHex);
    syncColorControls(bgColorHex, bgColorInput, "#ffd54f", refreshPreview);
    bgEnabled.addEventListener("change", () => {
      bgColorInput.disabled = !bgEnabled.checked;
      toggleColorPickerVisibility(bgEnabled, bgColorInput);
      toggleColorPickerVisibility(bgEnabled, bgColorHex);
      refreshPreview();
    });

    const styleWrap = container.createDiv("keyword-decorator-field");
    styleWrap.createEl("label", { text: "Text style" });
    const styleToggles = styleWrap.createDiv("keyword-decorator-inline-toggles");
    const bold = createToggle(styleToggles, "Bold", editingRule?.fontWeight === "700");
    const italic = createToggle(styleToggles, "Italic", Boolean(editingRule?.italic));
    const underline = createToggle(styleToggles, "Underline", Boolean(editingRule?.underline));

    const prefixWrap = container.createDiv("keyword-decorator-field");
    const prefixHeader = prefixWrap.createDiv("keyword-decorator-inline-header");
    prefixHeader.createEl("label", { text: "Prefix" });
    const prefixTypeSelect = prefixHeader.createEl("select");
    addOption(prefixTypeSelect, "emoji", "Emoji");
    addOption(prefixTypeSelect, "icon", "Lucide icon");
    addOption(prefixTypeSelect, "image", "Vault image");
    addOption(prefixTypeSelect, "none", "None");
    prefixTypeSelect.value = prefixType;
    const prefixValueRow = prefixWrap.createDiv("keyword-decorator-prefix-value-row");
    const prefixValue = new TextComponent(prefixValueRow);
    prefixValue.setValue(editingRule?.prefixValue || "");
    const imagePickButton = new ButtonComponent(prefixValueRow)
      .setButtonText("Pick")
      .onClick(() => {
        const modal = new VaultImageSuggestModal(this.app, file => {
          prefixValue.setValue(file.name);
          refreshPreview();
        });
        modal.open();
      });
    setPrefixPlaceholder(prefixTypeSelect.value as PrefixType, prefixValue);
    toggleImagePickerButton(prefixTypeSelect.value as PrefixType, imagePickButton);
    prefixTypeSelect.addEventListener("change", () => {
      setPrefixPlaceholder(prefixTypeSelect.value as PrefixType, prefixValue);
      toggleImagePickerButton(prefixTypeSelect.value as PrefixType, imagePickButton);
      refreshPreview();
    });

    const advanced = container.createEl("details", { cls: "keyword-decorator-advanced" });
    advanced.createEl("summary", { text: "Advanced options" });
    const advancedBody = advanced.createDiv("keyword-decorator-advanced-body");

    const classField = new TextComponent(advancedBody.createDiv("keyword-decorator-field"));
    classField.setPlaceholder("Custom CSS class (optional)");
    classField.setValue(editingRule?.class || "");

    ruleNameInput.inputEl.addEventListener("input", refreshPreview);
    textColorInput.addEventListener("input", refreshPreview);
    textColorHex.addEventListener("input", refreshPreview);
    bgColorInput.addEventListener("input", refreshPreview);
    bgColorHex.addEventListener("input", refreshPreview);
    bold.addEventListener("change", refreshPreview);
    italic.addEventListener("change", refreshPreview);
    underline.addEventListener("change", refreshPreview);
    prefixValue.inputEl.addEventListener("input", refreshPreview);
    refreshPreview();

    const customCss = new TextAreaComponent(advancedBody.createDiv("keyword-decorator-field"));
    customCss.setPlaceholder("Custom CSS (optional)");
    customCss.setValue(editingRule?.css || "");

    const buttonRow = container.createDiv("keyword-decorator-button-row");
    new ButtonComponent(buttonRow)
      .setButtonText(this.selectedRuleId ? "Update rule" : "Save rule")
      .setCta()
      .onClick(async () => {
        const queryMode = modeSelect.value as QueryMode;
        const rawQuery = queryMode === "multiple" ? queryTextarea.getValue().trim() : queryInput.getValue().trim();
        if (!validateQuery(queryMode, rawQuery)) {
          new Notice("关键词配置无效，请检查输入");
          return;
        }

        const ruleId = this.selectedRuleId || generateRuleId(config.queryOrder);
        if (!config.queryOrder.includes(ruleId)) {
          config.queryOrder.push(ruleId);
        }

        config.queries[ruleId] = {
          ...editingRule,
          query: rawQuery,
          queryMode,
          regex: queryMode === "regex",
          name: ruleNameInput.getValue().trim() || undefined,
          class: classField.getValue().trim().replace(/ /g, "-") || undefined,
          textColor: textColorEnabled.checked ? normalizeHex(textColorHex.value) || textColorInput.value : null,
          color: bgEnabled.checked ? normalizeHex(bgColorHex.value) || bgColorInput.value : null,
          fontWeight: bold.checked ? "700" : "",
          italic: italic.checked,
          underline: underline.checked,
          prefixType: prefixTypeSelect.value as PrefixType,
          prefixValue: prefixValue.getValue().trim(),
          css: customCss.getValue(),
          enabled: editingRule?.enabled ?? true,
        };

        this.selectedRuleId = ruleId;
        await this.plugin.saveSettings();
        this.plugin.updateStaticHighlighter();
        this.plugin.updateCustomCSS();
        this.plugin.updateStyles();
        this.display();
      });

    if (this.selectedRuleId) {
      new ButtonComponent(buttonRow)
        .setButtonText("Delete")
        .setWarning()
        .onClick(async () => {
          delete config.queries[this.selectedRuleId!];
          config.queryOrder = config.queryOrder.filter(id => id !== this.selectedRuleId);
          this.selectedRuleId = config.queryOrder[0] || null;
          await this.plugin.saveSettings();
          this.plugin.updateStaticHighlighter();
          this.plugin.updateCustomCSS();
          this.plugin.updateStyles();
          this.display();
        });
    }

    function refreshPreview() {
      const currentMode = modeSelect.value as QueryMode;
      const currentQuery = currentMode === "multiple" ? queryTextarea.getValue() : queryInput.getValue();
      const previewText = previewRuleName(currentQuery, currentMode);
      applyRulePreview(
        livePreview,
        app,
        {
          textColor: textColorEnabled.checked ? normalizeHex(textColorHex.value) || textColorInput.value : null,
          color: bgEnabled.checked ? normalizeHex(bgColorHex.value) || bgColorInput.value : null,
          fontWeight: bold.checked ? "700" : "",
          italic: italic.checked,
          underline: underline.checked,
          prefixType: prefixTypeSelect.value as PrefixType,
          prefixValue: prefixValue.getValue().trim(),
        },
        previewText
      );
    }
  }
}

function createToggle(parent: HTMLElement, label: string, checked: boolean) {
  const wrap = parent.createDiv("keyword-decorator-toggle-item");
  wrap.createEl("span", { text: label });
  const input = wrap.createEl("input", { type: "checkbox" });
  input.checked = checked;
  return input;
}

function addOption(select: HTMLSelectElement, value: string, label: string) {
  const option = document.createElement("option");
  option.value = value;
  option.text = label;
  select.appendChild(option);
}

function normalizeColor(color: string | null | undefined, fallback: string) {
  if (!color) return fallback;
  if (/^#[0-9a-fA-F]{6}$/.test(color)) return color;
  if (/^#[0-9a-fA-F]{8}$/.test(color)) return color.slice(0, 7);
  return fallback;
}

function toggleColorPickerVisibility(checkbox: HTMLInputElement, picker: HTMLInputElement) {
  picker.style.display = checkbox.checked ? "inline-block" : "none";
}

function normalizeHex(value: string) {
  const raw = value.trim();
  if (!raw) return "";
  const normalized = raw.startsWith("#") ? raw : `#${raw}`;
  if (/^#[0-9a-fA-F]{6}$/.test(normalized)) {
    return normalized.toUpperCase();
  }
  return "";
}

function syncColorControls(
  hexInput: HTMLInputElement,
  colorInput: HTMLInputElement,
  fallback: string,
  onChanged: () => void
) {
  const applyHexToPicker = () => {
    const normalized = normalizeHex(hexInput.value);
    if (normalized) {
      colorInput.value = normalized.toLowerCase();
      hexInput.value = normalized;
      onChanged();
    }
  };
  hexInput.addEventListener("input", applyHexToPicker);
  hexInput.addEventListener("blur", () => {
    const normalized = normalizeHex(hexInput.value);
    if (!normalized) {
      hexInput.value = (colorInput.value || fallback).toUpperCase();
    }
    onChanged();
  });
  colorInput.addEventListener("input", () => {
    hexInput.value = colorInput.value.toUpperCase();
    onChanged();
  });
}

function applyRulePreview(previewEl: HTMLElement, app: App, rule: any, text: string) {
  clearElement(previewEl);
  previewEl.style.display = "inline-flex";
  previewEl.style.alignItems = "center";
  previewEl.style.gap = "0.25em";

  const prefixEl = previewEl.createSpan({ cls: "keyword-decorator-live-prefix" });
  const textEl = previewEl.createSpan({ cls: "keyword-decorator-live-text", text });

  const prefixType = rule.prefixType as PrefixType;
  const prefixValue = String(rule.prefixValue || "").trim();
  if (!prefixType || prefixType === "none") {
    prefixEl.style.display = "none";
  } else if (prefixType === "emoji") {
    prefixEl.setText(prefixValue || "✨");
  } else if (prefixType === "icon") {
    try {
      setIcon(prefixEl, prefixValue || "sparkles");
    } catch {
      setIcon(prefixEl, "image-off");
    }
  } else {
    const src = resolveImagePreviewSrc(prefixValue, app);
    if (src) {
      const img = document.createElement("img");
      img.src = src;
      img.alt = "";
      img.addClass("keyword-decorator-prefix-image");
      img.onerror = () => {
        clearElement(prefixEl);
        setIcon(prefixEl, "image-off");
      };
      prefixEl.appendChild(img);
    } else {
      setIcon(prefixEl, "image-off");
    }
  }

  previewEl.style.color = rule.textColor || "";
  previewEl.style.backgroundColor = rule.color || "transparent";
  previewEl.style.fontWeight = rule.fontWeight || "";
  previewEl.style.fontStyle = rule.italic ? "italic" : "";
  previewEl.style.textDecoration = rule.underline ? "underline" : "";
}

function setPrefixPlaceholder(type: PrefixType, input: TextComponent) {
  if (type === "emoji") input.setPlaceholder("例如：⚡");
  if (type === "icon") input.setPlaceholder("例如：sparkles");
  if (type === "image") input.setPlaceholder("例如：logo.png");
  if (type === "none") input.setPlaceholder("No prefix");
}

function toggleImagePickerButton(type: PrefixType, button: ButtonComponent) {
  button.buttonEl.style.display = type === "image" ? "inline-flex" : "none";
}

function updateQueryInputByMode(mode: QueryMode, queryInput: TextComponent, queryTextarea: TextAreaComponent) {
  const input = queryInput.inputEl;
  const textarea = queryTextarea.inputEl;
  if (mode === "multiple") {
    input.style.display = "none";
    textarea.style.display = "block";
    textarea.placeholder = "每行一个关键词，或使用逗号分隔";
  } else {
    textarea.style.display = "none";
    input.style.display = "block";
    input.placeholder = mode === "regex" ? "输入正则表达式" : "输入关键词";
  }
}

function validateQuery(mode: QueryMode, value: string) {
  if (!value) return false;
  if (mode === "multiple") {
    return splitKeywords(value).length > 0;
  }
  if (mode === "regex") {
    try {
      new RegExp(value);
      return true;
    } catch {
      return false;
    }
  }
  return true;
}

function splitKeywords(value: string) {
  return value
    .split(/[\n,]/g)
    .map(v => v.trim())
    .filter(Boolean);
}

function previewRuleName(query: string, mode: QueryMode) {
  const trimmed = query.trim();
  if (mode === "regex") {
    return trimmed ? `/${trimmed}/` : "/正则/";
  }
  if (mode === "multiple") {
    const keywords = splitKeywords(trimmed);
    if (keywords.length === 0) return "关键字";
    if (keywords.length === 1) return keywords[0];
    return `${keywords[0]} 等`;
  }
  return trimmed || "关键字";
}

function inferMode(rule: any): QueryMode {
  if (!rule) return "single";
  if (rule.queryMode) return rule.queryMode;
  if (rule.regex) return "regex";
  if (/[\n,]/.test(rule.query || "")) return "multiple";
  return "single";
}

function generateRuleId(existingIds: string[]) {
  let id = `rule-${Date.now().toString(36)}`;
  while (existingIds.includes(id)) {
    id = `rule-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`;
  }
  return id;
}

function clearElement(el: HTMLElement) {
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
}

function resolveImagePreviewSrc(input: string, app: App): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  if (/^(https?:|data:|app:|file:)/.test(trimmed)) return trimmed;
  const normalized = trimmed.replace(/^!?\[\[/, "").replace(/\]\]$/, "").split("|")[0].trim();
  const direct = app.vault.getAbstractFileByPath(normalized);
  if (direct instanceof TFile) {
    return app.vault.getResourcePath(direct);
  }
  const lower = normalized.toLowerCase();
  const byName = app.vault.getFiles().find(file => file.name.toLowerCase() === lower);
  if (byName) {
    return app.vault.getResourcePath(byName);
  }
  const withoutExt = lower.replace(/\.[^.]+$/, "");
  const byBaseName = app.vault.getFiles().find(file => file.basename.toLowerCase() === withoutExt);
  if (byBaseName) {
    return app.vault.getResourcePath(byBaseName);
  }
  return "";
}

class VaultImageSuggestModal extends FuzzySuggestModal<TFile> {
  private readonly onChoose: (file: TFile) => void;

  constructor(app: App, onChoose: (file: TFile) => void) {
    super(app);
    this.onChoose = onChoose;
    this.setPlaceholder("Search image by filename");
  }

  getItems(): TFile[] {
    const imageExtensions = new Set(["png", "jpg", "jpeg", "gif", "bmp", "webp", "svg", "avif"]);
    return this.app.vault.getFiles().filter(file => imageExtensions.has(file.extension.toLowerCase()));
  }

  getItemText(item: TFile): string {
    return `${item.name}  (${item.path})`;
  }

  onChooseItem(item: TFile): void {
    this.onChoose(item);
  }
}
