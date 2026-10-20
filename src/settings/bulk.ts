import { App, ButtonComponent, Modal, Setting, TextAreaComponent } from "obsidian";
import { localize, t } from "../i18n";
import { DynamicHighlightsSettings, MAX_IMAGE_DIMENSION, normalizeSearchQuery, normalizeSettings, RuleGroup, SearchQueries, SearchQuery } from "./settings";

export interface BulkParseResult {
  rules: SearchQueries;
  queryOrder: string[];
  groups?: Record<string, RuleGroup>;
  groupOrder?: string[];
  errors: string[];
}

type BulkEntry = { name?: unknown; keyword?: unknown; image?: unknown; query?: unknown; regex?: unknown; [key: string]: unknown };
type JsonRuleEntry = { key: string; value: BulkEntry };
type JsonRuleData = { entries: JsonRuleEntry[]; groups?: Record<string, RuleGroup>; groupOrder?: string[] };

const APPEARANCE_FIELDS = [
  "class", "color", "textColor", "fontWeight", "italic", "underline", "prefixType", "prefixValue", "css",
  "hideText", "imageWidth", "imageHeight", "iconInheritColor", "backgroundIncludesMarker", "styleWholeLine", "prefixValues",
] as const;

function newRuleId(used: Set<string>): string {
  let id = "";
  do {
    const randomId = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2, 12);
    id = `rule-${randomId}`;
  } while (used.has(id));
  used.add(id);
  return id;
}

function entriesFromJson(raw: unknown): JsonRuleData | null {
  if (Array.isArray(raw)) return { entries: raw.map((value, index) => ({ key: String(index), value: value as BulkEntry })) };
  if (!raw || typeof raw !== "object") return null;
  const root = raw as Record<string, unknown>;
  const settings = root.staticHighlighter && typeof root.staticHighlighter === "object"
    ? root.staticHighlighter as Record<string, unknown>
    : root;
  const source = settings.queries && typeof settings.queries === "object" && !Array.isArray(settings.queries)
    ? settings.queries as Record<string, unknown>
    : settings;
  const entries = Object.entries(source)
    .filter(([key]) => !["queryOrder", "groups", "groupOrder", "enabled", "selectionHighlighter", "staticHighlighter"].includes(key))
    .map(([key, value]) => ({ key, value: value as BulkEntry }));
  const byId = new Map(entries.map(entry => [entry.key, entry]));
  const order = Array.isArray(settings.queryOrder) ? settings.queryOrder : [];
  const ordered: JsonRuleEntry[] = [];
  const seen = new Set<string>();
  for (const key of order) {
    if (typeof key === "string" && byId.has(key) && !seen.has(key)) {
      ordered.push(byId.get(key)!);
      seen.add(key);
    }
  }
  for (const entry of entries) if (!seen.has(entry.key)) ordered.push(entry);
  const groups = settings.groups && typeof settings.groups === "object" && !Array.isArray(settings.groups)
    ? settings.groups as Record<string, RuleGroup>
    : undefined;
  return { entries: ordered, groups, groupOrder: Array.isArray(settings.groupOrder) ? settings.groupOrder.filter((id): id is string => typeof id === "string") : undefined };
}

function copyAppearance(template?: SearchQuery, inheritStyle = false): Partial<SearchQuery> {
  if (!template || !inheritStyle) return {};
  const appearance: Record<string, unknown> = {};
  for (const field of APPEARANCE_FIELDS) {
    if (template[field] !== undefined) {
      if (field === "prefixValues") appearance[field] = template.prefixValues ? { ...template.prefixValues } : template.prefixValues;
      else appearance[field] = template[field];
    }
  }
  return appearance;
}

/** Add unique generated IDs, appending each rule to the matching query order. */
export function appendBulkRules(
  current: DynamicHighlightsSettings,
  added: SearchQueries,
  addedOrder: string[] = Object.keys(added),
  addedGroups: Record<string, RuleGroup> = {},
  addedGroupOrder: string[] = []
): DynamicHighlightsSettings {
  const queries = Object.assign(Object.create(null), current.staticHighlighter.queries) as SearchQueries;
  const queryOrder = [...current.staticHighlighter.queryOrder];
  const used = new Set(Object.keys(queries));
  const groups = Object.assign(Object.create(null), current.staticHighlighter.groups ?? {}) as Record<string, RuleGroup>;
  const usedGroups = new Set(Object.keys(groups));
  const groupIdMap = new Map<string, string>();
  for (const incomingId of addedGroupOrder) {
    if (!Object.prototype.hasOwnProperty.call(addedGroups, incomingId)) continue;
    const id = usedGroups.has(incomingId) ? newRuleId(usedGroups) : incomingId;
    usedGroups.add(id);
    groupIdMap.set(incomingId, id);
    groups[id] = addedGroups[incomingId];
  }
  for (const [incomingId, group] of Object.entries(addedGroups)) {
    if (groupIdMap.has(incomingId)) continue;
    const id = usedGroups.has(incomingId) ? newRuleId(usedGroups) : incomingId;
    usedGroups.add(id);
    groupIdMap.set(incomingId, id);
    groups[id] = group;
  }
  const orderedIds = [...addedOrder.filter(id => Object.prototype.hasOwnProperty.call(added, id))];
  for (const id of Object.keys(added)) if (!orderedIds.includes(id)) orderedIds.push(id);
  for (const incomingId of orderedIds) {
    const id = used.has(incomingId) ? newRuleId(used) : incomingId;
    used.add(id);
    queries[id] = { ...added[incomingId], ...(added[incomingId].groupId && groupIdMap.has(added[incomingId].groupId) ? { groupId: groupIdMap.get(added[incomingId].groupId) } : {}) };
    queryOrder.push(id);
  }
  const groupOrder = [...(current.staticHighlighter.groupOrder ?? [])];
  for (const incomingId of addedGroupOrder) {
    const mapped = groupIdMap.get(incomingId);
    if (mapped && !groupOrder.includes(mapped)) groupOrder.push(mapped);
  }
  for (const id of Object.keys(groups)) if (!groupOrder.includes(id)) groupOrder.push(id);
  return normalizeSettings({ ...current, staticHighlighter: { ...current.staticHighlighter, queries, queryOrder, groups, groupOrder } });
}

/** Parse keyword lines, three-column TSV, or JSON rule arrays / exported rule maps. */
export function parseBulkRules(
  text: string,
  template?: SearchQuery,
  existingIds: string[] = [],
  inheritStyle = false,
  existingGroupIds: string[] = []
): BulkParseResult {
  const rules = Object.create(null) as SearchQueries;
  const queryOrder: string[] = [];
  const errors: string[] = [];
  let groups: Record<string, RuleGroup> | undefined;
  let groupOrder: string[] | undefined;
  const groupIdMap = new Map<string, string>();
  const usedGroups = new Set(existingGroupIds);
  const used = new Set(existingIds);
  const add = (entry: BulkEntry, label: string, fromJson = false) => {
    const keyword = typeof entry.keyword === "string" ? entry.keyword.trim() : "";
    const queryText = typeof entry.query === "string" ? entry.query.trim() : keyword;
    const name = typeof entry.name === "string" && entry.name.trim() ? entry.name.trim() : queryText;
    if (!queryText) {
      errors.push(`${label}: keyword is empty.`);
      return;
    }

    let candidate: Record<string, unknown>;
    if (fromJson && (entry.query !== undefined || entry.regex !== undefined)) {
      candidate = { ...copyAppearance(template, inheritStyle), ...entry, query: queryText, name };
      if (candidate.regex === undefined) candidate.regex = candidate.queryMode === "regex";
    } else {
      const image = typeof entry.image === "string" ? entry.image.trim() : "";
      candidate = {
        ...copyAppearance(template, inheritStyle),
        query: queryText,
        name,
        regex: false,
        queryMode: "keywords",
        enabled: true,
        ...(image ? { prefixType: /^https?:\/\//i.test(image) ? "url" : "image", prefixValue: image } : {}),
      };
    }

    if (candidate.regex !== undefined && typeof candidate.regex !== "boolean") {
      errors.push(`${label}: regex must be a boolean.`);
      return;
    }
    if (candidate.queryMode !== undefined && (typeof candidate.queryMode !== "string" || !["keywords", "single", "multiple", "regex"].includes(candidate.queryMode))) {
      errors.push(`${label}: unsupported query mode.`);
      return;
    }
    if (candidate.queryMode !== undefined && candidate.regex !== undefined && ((candidate.queryMode === "regex") !== candidate.regex)) {
      errors.push(`${label}: regex and queryMode must agree.`);
      return;
    }
    const mode = candidate.queryMode || (candidate.regex === true ? "regex" : "single");
    if (mode === "regex") {
      try { new RegExp(queryText); } catch { errors.push(`${label}: invalid regular expression.`); return; }
    }
    if (candidate.prefixType !== undefined && (typeof candidate.prefixType !== "string" || !["none", "emoji", "icon", "image", "url", "svg"].includes(candidate.prefixType))) {
      errors.push(`${label}: unsupported prefix type.`);
      return;
    }
    for (const field of ["imageWidth", "imageHeight"]) {
      const dimension = candidate[field];
      if (dimension !== undefined && (typeof dimension !== "number" || !Number.isInteger(dimension) || dimension < 1 || dimension > MAX_IMAGE_DIMENSION)) {
        errors.push(`${label}: ${field} must be 1–${MAX_IMAGE_DIMENSION} pixels.`);
        return;
      }
    }
    const rule = normalizeSearchQuery(candidate);
    if (!rule) {
      errors.push(`${label}: malformed rule.`);
      return;
    }
    rule.query = queryText;
    rule.name = name;
    // New plain-text and TSV rules are active even when a visual template was selected.
    if (!fromJson) rule.enabled = true;
    const id = newRuleId(used);
    rules[id] = rule;
    queryOrder.push(id);
  };

  const trimmed = text.trim();
  if (!trimmed) return { rules, queryOrder, errors: ["Enter at least one keyword or rule."] };
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    let parsed: unknown;
    try { parsed = JSON.parse(trimmed); } catch (error) { return { rules, queryOrder, errors: [`Invalid JSON: ${String(error)}`] }; }
    const jsonData = entriesFromJson(parsed);
    if (!jsonData) return { rules, queryOrder, errors: ["JSON must be a rule array or an exported rule object."] };
    if (jsonData.groups) {
      groups = Object.create(null) as Record<string, RuleGroup>;
      groupOrder = [];
      const sourceOrder = [...(jsonData.groupOrder ?? []), ...Object.keys(jsonData.groups)];
      for (const sourceId of sourceOrder) {
        const group = jsonData.groups[sourceId];
        if (!group || groupIdMap.has(sourceId)) continue;
        const mappedId = usedGroups.has(sourceId) ? newRuleId(usedGroups) : sourceId;
        usedGroups.add(mappedId);
        groupIdMap.set(sourceId, mappedId);
        groups[mappedId] = group;
        groupOrder.push(mappedId);
      }
    }
    jsonData.entries.forEach(({ value }, index) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        errors.push(`Rule ${index + 1}: expected an object.`);
        return;
      }
      const countBefore = queryOrder.length;
      add(value, `Rule ${index + 1}`, true);
      const addedId = queryOrder[queryOrder.length - 1];
      const parsedGroupId = typeof value.groupId === "string" ? groupIdMap.get(value.groupId) : undefined;
      if (queryOrder.length > countBefore && addedId && parsedGroupId) rules[addedId].groupId = parsedGroupId;
      else if (queryOrder.length > countBefore && addedId && value.groupId !== undefined) {
        const missingGroup = typeof value.groupId === "string" ? `group “${value.groupId}”` : "group reference";
        errors.push(`Rule ${index + 1}: ${missingGroup} is missing from the imported data.`);
      }
    });
    return { rules, queryOrder, groups, groupOrder, errors };
  }

  const lines = trimmed.split(/\r?\n/);
  lines.forEach((line, index) => {
    const value = line.trim();
    if (!value) return;
    const columns = line.split("\t");
    if (columns.length >= 2) {
      add({ name: columns[0].trim(), keyword: columns[1].trim(), image: columns.slice(2).join("\t").trim() }, `Line ${index + 1}`);
    } else {
      add({ keyword: value }, `Line ${index + 1}`);
    }
  });
  return { rules, queryOrder, errors };
}

export class BulkAddModal extends Modal {
  constructor(
    app: App,
    private readonly onConfirm: (rules: SearchQueries, queryOrder: string[], groups?: Record<string, RuleGroup>, groupOrder?: string[]) => Promise<void> | void,
    private readonly template?: SearchQuery,
    private readonly existingIds: string[] = []
  ) {
    super(app);
  }

  onOpen() {
    const { contentEl, modalEl } = this;
    this.setTitle(t("bulk"));
    modalEl.addClass("modal-dynamic-highlights");
    contentEl.createEl("p", {
      cls: "kd-dialog-description",
      text: localize("One keyword per line, or tab-separated name, keyword and optional image path. JSON rule arrays and exports are also supported.", "每行一个关键词；也可从表格粘贴名称、关键词、图片路径（可选）三列，或粘贴 JSON 规则数组／导出内容。"),
    });
    const body = contentEl.createDiv({ cls: "kd-dialog-body" });
    let inheritStyle = false;
    let refreshPreview = () => {};
    let preview: HTMLDivElement;
    let parsed: BulkParseResult = { rules: {}, queryOrder: [], errors: [] };
    const textarea = new TextAreaComponent(body)
      .setPlaceholder(localize("Keyword one\nkeyword two", "关键词一\n关键词二"));
    textarea.then(textarea => {
      textarea.inputEl.addClass("kd-dialog-input");
      textarea.inputEl.setAttribute("aria-label", localize("Rules to add", "要添加的规则"));
      const options = contentEl.createDiv("kd-dialog-options");
      if (this.template) {
        const option = new Setting(options)
          .setName(localize("Inherit selected rule appearance", "继承所选规则的外观"))
          .addToggle(toggle => toggle.setValue(false).onChange(value => {
            inheritStyle = value;
            refreshPreview();
          }));
        option.settingEl.addClass("kd-dialog-option");
      }
      preview = options.createDiv({ cls: "kd-dialog-preview", attr: { "aria-live": "polite" } });
      const footer = contentEl.createDiv({ cls: "kd-dialog-footer" });
      const cancelButton = new ButtonComponent(footer)
        .setButtonText(localize("Cancel", "取消"))
        .onClick(() => this.close());
      const addButton = new ButtonComponent(footer)
        .setButtonText(localize("Add rules", "添加规则"))
        .setCta();
      const refresh = () => {
        parsed = parseBulkRules(textarea.getValue(), this.template, this.existingIds, inheritStyle);
        preview.empty();
        const count = parsed.queryOrder.length;
        preview.createDiv({ text: localize(`${count} rules ready to add`, `将添加 ${count} 条规则`) });
        if (parsed.errors.length) {
          preview.addClass("is-error");
          const errors = preview.createEl("ul");
          for (const error of parsed.errors) errors.createEl("li", { text: error });
        } else {
          preview.removeClass("is-error");
        }
        addButton.setDisabled(count === 0 || parsed.errors.length > 0 || addButton.buttonEl.hasClass("is-busy"));
      };
      refreshPreview = refresh;
      textarea.inputEl.addEventListener("input", refresh);
      addButton.onClick(async () => {
        refresh();
        if (parsed.errors.length || Object.keys(parsed.rules).length === 0) return;
        addButton.setDisabled(true);
        cancelButton.setDisabled(true);
        addButton.buttonEl.addClass("is-busy");
        addButton.setButtonText(localize("Adding…", "正在添加…"));
        try {
          await this.onConfirm(parsed.rules, parsed.queryOrder, parsed.groups, parsed.groupOrder);
          this.close();
        } catch (error) {
          preview.empty();
          preview.addClass("is-error");
          preview.createDiv({ text: localize("Could not add rules. Check the error and retry.", "无法添加规则，请检查错误后重试。") });
          preview.createEl("p", { text: String(error) });
          addButton.buttonEl.removeClass("is-busy");
          addButton.setButtonText(localize("Retry", "重试"));
          addButton.setDisabled(false);
          cancelButton.setDisabled(false);
        }
      });
      refresh();
    });
  }

  onClose() { this.contentEl.empty(); }
}
