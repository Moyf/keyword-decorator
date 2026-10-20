import { App, ButtonComponent, Modal, Setting, TextAreaComponent } from "obsidian";
import { localize } from "../i18n";
import type DynamicHighlightsPlugin from "../main";
import { DynamicHighlightsSettings, MAX_IMAGE_DIMENSION, normalizeSearchQuery, normalizeSettings, PrefixType, RuleGroup, SearchQueries } from "./settings";

export interface ParsedSettingsImport {
  queries: SearchQueries;
  queryOrder: string[];
  groups?: Record<string, RuleGroup>;
  groupOrder?: string[];
  enabled?: boolean;
  installedPresets?: string[];
}

/** Parse old query-map exports and the newer full-settings package without mutating live settings. */
export function parseSettingsImport(raw: unknown): { value?: ParsedSettingsImport; errors: string[] } {
  const errors: string[] = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { errors: ["Imported data must be a JSON object."] };
  }
  const root = raw as Record<string, unknown>;
  const settingsSource = root.staticHighlighter && typeof root.staticHighlighter === "object"
    ? root.staticHighlighter as Record<string, unknown>
    : root;
  const queriesRaw = settingsSource.queries && typeof settingsSource.queries === "object" && !Array.isArray(settingsSource.queries)
    ? settingsSource.queries as Record<string, unknown>
    : settingsSource;
  const reserved = new Set(["enabled", "queryOrder", "groups", "groupOrder", "installedPresets", "selectionHighlighter", "staticHighlighter", "version"]);
  const queries = Object.create(null) as SearchQueries;
  for (const [id, value] of Object.entries(queriesRaw)) {
    if (reserved.has(id)) continue;
    if (id === "__proto__") {
      errors.push("Rule ID “__proto__” is not allowed.");
      continue;
    }
    const query = normalizeSearchQuery(value);
    if (!id.trim()) {
      errors.push("A rule has an empty ID.");
      continue;
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      errors.push(`Rule “${id}” must be an object.`);
      continue;
    }
    if (!query) {
      errors.push(`Rule “${id}” is malformed or has an invalid regular expression.`);
      continue;
    }
    queries[id] = query;
    const candidate = value as Record<string, unknown>;
    const mode = typeof candidate.queryMode === "string" && ["keywords", "single", "multiple", "regex", "emoji-shortcodes"].includes(candidate.queryMode)
      ? candidate.queryMode
      : candidate.regex === true ? "regex" : "single";
    if (candidate.regex !== undefined && typeof candidate.regex !== "boolean") {
      errors.push(`Rule “${id}” has an invalid regex flag.`);
    } else if (candidate.queryMode !== undefined && typeof candidate.regex === "boolean" && (candidate.regex !== (mode === "regex"))) {
      errors.push(`Rule “${id}” has mismatched regex and queryMode values.`);
    }
    if (mode === "regex" && typeof candidate.query === "string") {
      try { new RegExp(candidate.query); } catch { errors.push(`Rule “${id}” has an invalid regular expression.`); }
    }
    if (candidate.prefixType !== undefined && (typeof candidate.prefixType !== "string" || !["none", "emoji", "icon", "image", "url", "svg"].includes(candidate.prefixType))) {
      errors.push(`Rule “${id}” has an unsupported prefix type.`);
    }
    if (candidate.groupId !== undefined && (typeof candidate.groupId !== "string" || !candidate.groupId.trim())) errors.push(`Rule “${id}” has an invalid groupId.`);
    for (const field of ["imageWidth", "imageHeight"]) {
      const dimension = candidate[field];
      if (dimension !== undefined && (typeof dimension !== "number" || !Number.isInteger(dimension) || dimension < 1 || dimension > MAX_IMAGE_DIMENSION)) {
        errors.push(`Rule “${id}” has an invalid ${field} (expected 1–${MAX_IMAGE_DIMENSION} pixels).`);
      }
    }
    if (candidate.queryMode !== undefined && (typeof candidate.queryMode !== "string" || !["keywords", "single", "multiple", "regex", "emoji-shortcodes"].includes(candidate.queryMode))) {
      errors.push(`Rule “${id}” has an unsupported query mode.`);
    }
    const stringFields = ["class", "name", "fontWeight", "prefixValue", "css"];
    for (const field of stringFields) {
      if (candidate[field] !== undefined && typeof candidate[field] !== "string") {
        errors.push(`Rule “${id}” has an invalid ${field}.`);
      }
    }
    for (const field of ["color", "textColor"]) {
      if (candidate[field] !== undefined && candidate[field] !== null && typeof candidate[field] !== "string") {
        errors.push(`Rule “${id}” has an invalid ${field}.`);
      }
    }
    for (const field of ["italic", "underline", "enabled", "hideText", "iconInheritColor", "backgroundIncludesMarker", "styleWholeLine"]) {
      if (candidate[field] !== undefined && typeof candidate[field] !== "boolean") {
        errors.push(`Rule “${id}” has an invalid ${field}.`);
      }
    }
    validatePrefixValues(candidate.prefixValues, `Rule “${id}”`, errors);
    if (candidate.mark !== undefined && (!Array.isArray(candidate.mark) || candidate.mark.some((mark: unknown) => typeof mark !== "string" || !["line", "match", "group", "start", "end"].includes(mark)))) {
      errors.push(`Rule “${id}” has invalid mark values.`);
    }
  }
  const orderInput: unknown[] = Array.isArray(settingsSource.queryOrder) ? settingsSource.queryOrder : [];
  const queryOrder: string[] = [];
  for (const id of orderInput) {
    if (typeof id === "string" && Object.prototype.hasOwnProperty.call(queries, id) && !queryOrder.includes(id)) {
      queryOrder.push(id);
    }
  }
  for (const id of Object.keys(queries)) if (!queryOrder.includes(id)) queryOrder.push(id);
  const groups = parseGroups(settingsSource.groups, errors);
  const groupOrder = parseGroupOrder(settingsSource.groupOrder, groups, errors);
  for (const [id, query] of Object.entries(queries)) {
    if (query.groupId && !Object.prototype.hasOwnProperty.call(groups, query.groupId)) {
      errors.push(`Rule “${id}” refers to missing group “${query.groupId}”.`);
    }
  }
  const enabled = typeof root.enabled === "boolean" ? root.enabled : undefined;
  const installed = settingsSource.installedPresets;
  if (installed !== undefined && (!Array.isArray(installed) || installed.some(id => typeof id !== "string"))) errors.push("Installed presets must be an array of IDs.");
  const installedPresets = Array.isArray(installed) ? installed.filter((id): id is string => typeof id === "string") : undefined;
  return errors.length ? { errors } : { value: { queries, queryOrder, groups, groupOrder, enabled, installedPresets }, errors };
}

const prefixTypes: PrefixType[] = ["none", "emoji", "icon", "image", "url", "svg"];
const appearanceStringFields = ["class", "fontWeight", "prefixValue", "css"];
const appearanceBooleanFields = ["italic", "underline", "hideText", "iconInheritColor", "backgroundIncludesMarker", "styleWholeLine"];

function validatePrefixValues(value: unknown, label: string, errors: string[]) {
  if (value === undefined) return;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    errors.push(`${label} has invalid prefixValues.`);
    return;
  }
  for (const [type, prefixValue] of Object.entries(value)) {
    if (!prefixTypes.includes(type as PrefixType) || typeof prefixValue !== "string") errors.push(`${label} has invalid prefixValues entry “${type}”.`);
  }
}

function validateAppearance(value: Record<string, unknown>, label: string, errors: string[]) {
  for (const field of appearanceStringFields) if (value[field] !== undefined && typeof value[field] !== "string") errors.push(`${label} has an invalid ${field}.`);
  for (const field of ["color", "textColor"]) if (value[field] !== undefined && value[field] !== null && typeof value[field] !== "string") errors.push(`${label} has an invalid ${field}.`);
  for (const field of appearanceBooleanFields) if (value[field] !== undefined && typeof value[field] !== "boolean") errors.push(`${label} has an invalid ${field}.`);
  if (value.prefixType !== undefined && (typeof value.prefixType !== "string" || !prefixTypes.includes(value.prefixType as PrefixType))) errors.push(`${label} has an unsupported prefix type.`);
  for (const field of ["imageWidth", "imageHeight"]) {
    const dimension = value[field];
    if (dimension !== undefined && (typeof dimension !== "number" || !Number.isInteger(dimension) || dimension < 1 || dimension > MAX_IMAGE_DIMENSION)) errors.push(`${label} has an invalid ${field} (expected 1–${MAX_IMAGE_DIMENSION} pixels).`);
  }
  validatePrefixValues(value.prefixValues, label, errors);
}

function parseGroups(value: unknown, errors: string[]): Record<string, RuleGroup> | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    errors.push("Groups must be a JSON object.");
    return undefined;
  }
  const groups = Object.create(null) as Record<string, RuleGroup>;
  for (const [id, rawGroup] of Object.entries(value)) {
    const label = `Group “${id}”`;
    if (!id.trim() || id === "__proto__" || !rawGroup || typeof rawGroup !== "object" || Array.isArray(rawGroup)) {
      errors.push(`${label} is malformed.`);
      continue;
    }
    const candidate = rawGroup as Record<string, unknown>;
    if (typeof candidate.name !== "string") errors.push(`${label} needs a string name.`);
    for (const field of ["enabled", "collapsed"]) if (candidate[field] !== undefined && typeof candidate[field] !== "boolean") errors.push(`${label} has an invalid ${field} flag.`);
    let style: RuleGroup["style"];
    if (candidate.style !== undefined) {
      if (!candidate.style || typeof candidate.style !== "object" || Array.isArray(candidate.style)) errors.push(`${label} has invalid style.`);
      else {
        const rawStyle = candidate.style as Record<string, unknown>;
        for (const field of ["query", "regex", "queryMode", "name", "enabled", "groupId", "mark"])
          if (Object.prototype.hasOwnProperty.call(rawStyle, field)) errors.push(`${label} style cannot contain ${field}.`);
        validateAppearance(rawStyle, `${label} style`, errors);
        style = rawStyle;
      }
    }
    if (typeof candidate.name === "string") {
      groups[id] = {
        name: candidate.name,
        ...(typeof candidate.enabled === "boolean" ? { enabled: candidate.enabled } : {}),
        ...(typeof candidate.collapsed === "boolean" ? { collapsed: candidate.collapsed } : {}),
        ...(style ? { style } : {}),
      };
    }
  }
  return groups;
}

function parseGroupOrder(value: unknown, groups: Record<string, RuleGroup> | undefined, errors: string[]): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.some(id => typeof id !== "string")) {
    errors.push("Group order must be an array of IDs.");
    return undefined;
  }
  const result: string[] = [];
  for (const id of value as string[]) {
    if (!groups || !Object.prototype.hasOwnProperty.call(groups, id)) errors.push(`Group order refers to missing group “${id}”.`);
    else if (!result.includes(id)) result.push(id);
  }
  for (const id of Object.keys(groups ?? {})) if (!result.includes(id)) result.push(id);
  return result;
}

export function applySettingsImport(value: ParsedSettingsImport, current: DynamicHighlightsSettings, mode: "merge" | "replace"): DynamicHighlightsSettings {
  // A replaced/deleted preset must not come back after the next reload.
  const installedPresets = [...new Set([...(current.staticHighlighter.installedPresets ?? []), ...(value.installedPresets ?? [])])];
  if (mode === "replace") {
    const normalized = normalizeSettings({
      enabled: value.enabled ?? current.enabled,
      selectionHighlighter: current.selectionHighlighter,
      staticHighlighter: { queries: value.queries, queryOrder: value.queryOrder, groups: value.groups ?? {}, groupOrder: value.groupOrder ?? [], installedPresets },
    });
    return normalized;
  }
  const queries = { ...current.staticHighlighter.queries, ...value.queries };
  const queryOrder = [...current.staticHighlighter.queryOrder];
  for (const id of value.queryOrder) if (!queryOrder.includes(id)) queryOrder.push(id);
  // Full imports preserve IDs so incoming rules keep their references; a matching group ID updates that group.
  const groups = value.groups === undefined ? current.staticHighlighter.groups : { ...current.staticHighlighter.groups, ...value.groups };
  const groupOrder = [...(current.staticHighlighter.groupOrder ?? [])];
  for (const id of value.groupOrder ?? []) if (!groupOrder.includes(id)) groupOrder.push(id);
  return normalizeSettings({
    ...current,
    enabled: value.enabled ?? current.enabled,
    staticHighlighter: { ...current.staticHighlighter, queries, queryOrder, groups, groupOrder, installedPresets },
  });
}

/** Import preview is always derived from the current text, before touching live settings. */
export class ImportModal extends Modal {
  private parsed?: ParsedSettingsImport;
  private errors: string[] = [];
  private mode: "merge" | "replace" = "merge";
  private allowEmptyReplace = false;
  private revision = 0;

  constructor(app: App, private readonly plugin: DynamicHighlightsPlugin) { super(app); }

  onOpen() {
    const { contentEl, modalEl } = this;
    this.setTitle(localize("Import rules", "导入规则"));
    modalEl.addClass("modal-dynamic-highlights");
    contentEl.createEl("p", { cls: "kd-dialog-description", text: localize("Paste an export or choose a JSON file. Review the result before importing.", "粘贴导出内容或选择 JSON 文件，确认下方预览后导入。") });
    const body = contentEl.createDiv("kd-dialog-body");
    const source = body.createDiv("kd-dialog-source");
    const fileInput = body.createEl("input", { cls: "kd-dialog-file-input", type: "file", attr: { accept: ".json,application/json", tabindex: "-1" } });
    const chooseFile = new ButtonComponent(source).setIcon("file-json").setButtonText(localize("Choose JSON file", "选择 JSON 文件")).onClick(() => fileInput.click());
    const sourceName = source.createSpan({ cls: "kd-dialog-source-name", text: localize("Or paste JSON below", "也可直接在下方粘贴 JSON") });
    const textarea = new TextAreaComponent(body).setPlaceholder(localize("Paste exported JSON here…", "粘贴 JSON 导出内容…"));
    textarea.inputEl.addClass("kd-dialog-input");
    textarea.inputEl.spellcheck = false;
    textarea.inputEl.setAttribute("aria-label", localize("Rules JSON", "规则 JSON"));
    const options = contentEl.createDiv("kd-dialog-options");
    let applying = false;
    let readingFile = false;
    let applyButton: ButtonComponent;
    let resetEmptyConfirmation = () => {};
    const modeSetting = new Setting(options).setName(localize("Import behavior", "导入方式"));
    modeSetting.settingEl.addClass("kd-dialog-option");
    modeSetting.addDropdown(dropdown => dropdown
      .addOption("merge", localize("Merge rules", "合并规则"))
      .addOption("replace", localize("Replace all rules", "替换全部规则"))
      .setValue(this.mode)
      .onChange(value => {
        this.mode = value as "merge" | "replace";
        this.allowEmptyReplace = false; resetEmptyConfirmation(); refresh();
      }));
    const emptyConfirmation = new Setting(options)
      .setName(localize("Clear all existing rules", "清空所有现有规则"))
      .setDesc(localize("This empty replacement will remove every current rule.", "本次导入没有规则，替换后会删除所有现有规则。"))
      .addToggle(toggle => {
        toggle.setValue(false).onChange(value => { this.allowEmptyReplace = value; updateApply(); });
        resetEmptyConfirmation = () => { toggle.setValue(false); };
      });
    emptyConfirmation.settingEl.addClass("kd-dialog-option");
    const preview = options.createDiv({ cls: "kd-dialog-preview", attr: { "aria-live": "polite", role: "status" } });
    function hasEmptyReplacement(parsed: ParsedSettingsImport | undefined, mode: string) {
      return mode === "replace" && parsed?.queryOrder.length === 0;
    }
    const updateApply = () => {
      const empty = hasEmptyReplacement(this.parsed, this.mode);
      applyButton.setDisabled(applying || readingFile || !this.parsed || !!this.errors.length || (empty && !this.allowEmptyReplace));
      applyButton.setButtonText(applying ? localize("Importing…", "正在导入…") : empty ? localize("Clear all rules", "清空全部规则") : localize("Import rules", "导入规则"));
      textarea.inputEl.disabled = applying; chooseFile.setDisabled(applying || readingFile);
    };
    const refresh = () => {
      this.parsed = undefined; this.errors = [];
      const input = textarea.getValue().trim();
      if (input) {
        try {
          const parsed = parseSettingsImport(JSON.parse(input));
          this.parsed = parsed.value; this.errors = parsed.errors;
        } catch {
          this.errors = [localize("Invalid JSON. Check the brackets, quotes and commas.", "JSON 格式无效，请检查括号、引号和逗号。")];
        }
      }
      modeSetting.setDesc(this.mode === "merge"
        ? localize("Keep current rules. Imported rules with the same ID will update them.", "保留现有规则；导入内容中相同 ID 的规则会更新。")
        : localize("Replace the current rule list with the imported rules.", "用导入的规则替换当前规则列表。"));
      emptyConfirmation.settingEl.toggleClass("is-hidden", !hasEmptyReplacement(this.parsed, this.mode));
      preview.toggleClass("is-error", !!this.errors.length);
      textarea.inputEl.setAttribute("aria-invalid", String(!!this.errors.length));
      preview.setText(this.errors.length ? this.errors.join("\n") : this.parsed
        ? localize(`${this.parsed.queryOrder.length} rules ready to ${this.mode === "merge" ? "merge" : "replace the current list"}.`, `已读取 ${this.parsed.queryOrder.length} 条规则，将${this.mode === "merge" ? "合并到" : "替换"}当前列表。`)
        : localize("A summary will appear here when you add JSON.", "粘贴或选择文件后，这里会显示导入摘要。"));
      updateApply();
    };
    textarea.onChange(() => {
      this.revision++; readingFile = false; this.allowEmptyReplace = false; resetEmptyConfirmation();
      sourceName.setText(localize("Pasted JSON", "已粘贴的 JSON")); refresh();
    });
    fileInput.addEventListener("change", () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      const revision = ++this.revision;
      fileInput.value = "";
      readingFile = true; this.parsed = undefined; updateApply(); sourceName.setText(file.name);
      void file.text().then(text => {
        if (revision !== this.revision || !body.isConnected) return;
        readingFile = false;
        textarea.setValue(text); sourceName.setText(file.name);
        this.allowEmptyReplace = false; resetEmptyConfirmation(); refresh();
      }).catch(() => {
        if (revision !== this.revision || !body.isConnected) return;
        readingFile = false; this.parsed = undefined;
        this.errors = [localize("Could not read the file. Choose it again or paste its contents.", "无法读取文件，请重新选择或直接粘贴内容。")];
        preview.addClass("is-error"); preview.setText(this.errors[0]); updateApply();
      });
    });
    const footer = contentEl.createDiv("kd-dialog-footer");
    const cancel = new ButtonComponent(footer).setButtonText(localize("Cancel", "取消")).onClick(() => this.close());
    applyButton = new ButtonComponent(footer).setButtonText(localize("Import rules", "导入规则")).setCta().onClick(() => {
      if (applying) return;
      refresh();
      if (!this.parsed || this.errors.length || (hasEmptyReplacement(this.parsed, this.mode) && !this.allowEmptyReplace)) return;
      applying = true; cancel.setDisabled(true); updateApply();
      this.plugin.settings = applySettingsImport(this.parsed, this.plugin.settings, this.mode);
      void this.plugin.saveSettings().then(() => {
        this.plugin.settingsTab.refresh(); this.close();
      }).catch(error => {
        if (!body.isConnected) return;
        applying = false; cancel.setDisabled(false); updateApply();
        preview.addClass("is-error");
        preview.setText(localize(`Import failed: ${String(error)}`, `导入失败：${String(error)}`));
      });
    });
    refresh();
  }

  onClose() { this.revision++; this.contentEl.empty(); }
}
