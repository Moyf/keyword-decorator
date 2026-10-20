import type { SelectionHighlightOptions } from "../highlighters/selection";
import { ignoredWords } from "./ignoredWords";

export type markTypes = "line" | "match" | "group" | "start" | "end";
export type PrefixType = "none" | "emoji" | "icon" | "image" | "url" | "svg";
export type QueryMode = "keywords" | "single" | "multiple" | "regex";

export type SettingValue = number | string | boolean;
export interface CSSSettings {
  [key: string]: SettingValue;
}

export interface SearchQuery {
  query: string;
  class?: string;
  name?: string;
  color?: string | null;
  textColor?: string | null;
  fontWeight?: string;
  italic?: boolean;
  underline?: boolean;
  queryMode?: QueryMode;
  prefixType?: PrefixType;
  prefixValue?: string;
  regex: boolean;
  mark?: markTypes[];
  css?: string;
  enabled?: boolean;
  hideText?: boolean;
  imageWidth?: number;
  imageHeight?: number;
  groupId?: string;
  iconInheritColor?: boolean;
  backgroundIncludesMarker?: boolean;
  styleWholeLine?: boolean;
  prefixValues?: Partial<Record<PrefixType, string>>;
}
export type RuleAppearance = Omit<SearchQuery, "query" | "regex" | "queryMode" | "name" | "enabled" | "groupId" | "mark">;
export interface RuleGroup {
  name: string;
  enabled?: boolean;
  collapsed?: boolean;
  style?: RuleAppearance;
}
export interface SearchQueries {
  [key: string]: SearchQuery;
}

export interface StaticHighlightOptions {
  queries: SearchQueries;
  queryOrder: string[];
  groups?: Record<string, RuleGroup>;
  groupOrder?: string[];
}

export type HighlighterOptions = SelectionHighlightOptions | StaticHighlightOptions;

export interface DynamicHighlightsSettings {
  enabled: boolean;
  selectionHighlighter: SelectionHighlightOptions;
  staticHighlighter: StaticHighlightOptions;
}

export const DEFAULT_SETTINGS: DynamicHighlightsSettings = {
  enabled: true,
  selectionHighlighter: {
    highlightWordAroundCursor: true,
    highlightSelectedText: true,
    maxMatches: 100,
    minSelectionLength: 3,
    highlightDelay: 200,
    ignoredWords: ignoredWords,
  },
  staticHighlighter: {
    queries: {},
    queryOrder: [],
    groups: {},
    groupOrder: [],
  },
};

const validPrefixTypes: PrefixType[] = ["none", "emoji", "icon", "image", "url", "svg"];
const validQueryModes: QueryMode[] = ["keywords", "single", "multiple", "regex"];
const validMarks: markTypes[] = ["line", "match", "group", "start", "end"];
export const MAX_IMAGE_DIMENSION = 512;

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPositiveDimension(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value > 0 && value <= MAX_IMAGE_DIMENSION;
}

export function normalizeSearchQuery(value: unknown): SearchQuery | null {
  if (!isRecord(value)) return null;
  if (typeof value.query !== "string") return null;

  const mode = validQueryModes.includes(value.queryMode as QueryMode)
    ? (value.queryMode as QueryMode)
    : value.regex === true ? "regex" : "single";
  const prefixType = validPrefixTypes.includes(value.prefixType as PrefixType)
    ? (value.prefixType as PrefixType)
    : undefined;
  const mark = Array.isArray(value.mark)
    ? value.mark.filter((item): item is markTypes => validMarks.includes(item as markTypes))
    : undefined;
  const query: SearchQuery = {
    query: value.query,
    regex: mode === "regex",
    queryMode: mode,
  };
  const knownFields = new Set([
    "query", "regex", "queryMode", "hideText", "imageWidth", "imageHeight", "class", "name", "color", "textColor",
    "fontWeight", "italic", "underline", "prefixType", "prefixValue", "css", "enabled", "mark", "groupId",
    "iconInheritColor", "backgroundIncludesMarker", "styleWholeLine", "prefixValues",
  ]);
  for (const [key, extra] of Object.entries(value)) {
    if (key !== "__proto__" && !knownFields.has(key)) {
      Object.defineProperty(query, key, { configurable: true, enumerable: true, value: extra, writable: true });
    }
  }
  if (typeof value.class === "string") query.class = value.class;
  if (typeof value.name === "string") query.name = value.name;
  if (typeof value.color === "string" || value.color === null) query.color = value.color;
  if (typeof value.textColor === "string" || value.textColor === null) query.textColor = value.textColor;
  if (typeof value.fontWeight === "string") query.fontWeight = value.fontWeight;
  if (typeof value.italic === "boolean") query.italic = value.italic;
  if (typeof value.underline === "boolean") query.underline = value.underline;
  if (prefixType) query.prefixType = prefixType;
  if (typeof value.prefixValue === "string") query.prefixValue = value.prefixValue;
  if (typeof value.css === "string") query.css = value.css;
  if (typeof value.enabled === "boolean") query.enabled = value.enabled;
  if (typeof value.hideText === "boolean") query.hideText = value.hideText;
  if (isPositiveDimension(value.imageWidth)) query.imageWidth = value.imageWidth;
  if (isPositiveDimension(value.imageHeight)) query.imageHeight = value.imageHeight;
  if (typeof value.groupId === "string" && value.groupId.trim()) query.groupId = value.groupId;
  if (typeof value.iconInheritColor === "boolean") query.iconInheritColor = value.iconInheritColor;
  if (typeof value.backgroundIncludesMarker === "boolean") query.backgroundIncludesMarker = value.backgroundIncludesMarker;
  if (typeof value.styleWholeLine === "boolean") query.styleWholeLine = value.styleWholeLine;
  if (isRecord(value.prefixValues)) {
    const prefixValues: Partial<Record<PrefixType, string>> = {};
    for (const [type, prefixValue] of Object.entries(value.prefixValues)) {
      if (validPrefixTypes.includes(type as PrefixType) && typeof prefixValue === "string") prefixValues[type as PrefixType] = prefixValue;
    }
    query.prefixValues = prefixValues;
  }
  if (mark) query.mark = mark;
  return query;
}

/** Repair legacy or partially damaged settings without allowing malformed fields to crash the plugin. */
export function normalizeSettings(raw: unknown): DynamicHighlightsSettings {
  const source = isRecord(raw) ? raw : {};
  const selection = isRecord(source.selectionHighlighter) ? source.selectionHighlighter : {};
  const staticOptions = isRecord(source.staticHighlighter) ? source.staticHighlighter : {};
  const rawQueries = isRecord(staticOptions.queries) ? staticOptions.queries : {};
  const queries = Object.create(null) as SearchQueries;
  for (const [id, value] of Object.entries(rawQueries)) {
    if (!id.trim() || id === "__proto__") continue;
    const query = normalizeSearchQuery(value);
    if (query) queries[id] = query;
  }
  const seen = new Set<string>();
  const queryOrder: string[] = [];
  if (Array.isArray(staticOptions.queryOrder)) {
    for (const id of staticOptions.queryOrder) {
      if (typeof id === "string" && Object.prototype.hasOwnProperty.call(queries, id) && !seen.has(id)) {
        seen.add(id);
        queryOrder.push(id);
      }
    }
  }
  for (const id of Object.keys(queries)) {
    if (!seen.has(id)) queryOrder.push(id);
  }
  const groups = normalizeRuleGroups(staticOptions.groups);
  for (const rule of Object.values(queries)) {
    if (rule.groupId && !Object.prototype.hasOwnProperty.call(groups, rule.groupId)) delete rule.groupId;
  }
  const groupSeen = new Set<string>();
  const groupOrder: string[] = [];
  if (Array.isArray(staticOptions.groupOrder)) {
    for (const id of staticOptions.groupOrder) {
      if (typeof id === "string" && Object.prototype.hasOwnProperty.call(groups, id) && !groupSeen.has(id)) {
        groupSeen.add(id);
        groupOrder.push(id);
      }
    }
  }
  for (const id of Object.keys(groups)) if (!groupSeen.has(id)) groupOrder.push(id);
  const defaults = DEFAULT_SETTINGS.selectionHighlighter;
  const numberOr = (key: string, fallback: number) => typeof selection[key] === "number" && Number.isFinite(selection[key]) ? selection[key] : fallback;
  const booleanOr = (key: string, fallback: boolean) => typeof selection[key] === "boolean" ? selection[key] : fallback;
  const isStringArray = (value: unknown): value is string[] =>
    Array.isArray(value) && value.every((item: unknown) => typeof item === "string");
  const ignored = typeof selection.ignoredWords === "string"
    ? selection.ignoredWords
    : isStringArray(selection.ignoredWords)
      ? selection.ignoredWords.join(",")
      : defaults.ignoredWords;
  return {
    ...source,
    enabled: typeof source.enabled === "boolean" ? source.enabled : true,
    selectionHighlighter: {
      ...selection,
      highlightWordAroundCursor: booleanOr("highlightWordAroundCursor", defaults.highlightWordAroundCursor),
      highlightSelectedText: booleanOr("highlightSelectedText", defaults.highlightSelectedText),
      maxMatches: Math.max(1, numberOr("maxMatches", defaults.maxMatches)),
      minSelectionLength: Math.max(0, numberOr("minSelectionLength", defaults.minSelectionLength)),
      highlightDelay: Math.max(0, numberOr("highlightDelay", defaults.highlightDelay)),
      ignoredWords: ignored,
    },
    staticHighlighter: { ...staticOptions, queries, queryOrder, groups, groupOrder },
  };
}

function normalizeRuleAppearance(value: unknown): RuleAppearance | undefined {
  if (!isRecord(value)) return undefined;
  const appearance: Record<string, unknown> = {};
  const blocked = new Set(["query", "regex", "queryMode", "name", "enabled", "groupId", "mark"]);
  const known = new Set([
    ...blocked, "class", "color", "textColor", "fontWeight", "italic", "underline", "prefixType", "prefixValue", "prefixValues",
    "css", "hideText", "imageWidth", "imageHeight", "iconInheritColor", "backgroundIncludesMarker", "styleWholeLine",
  ]);
  for (const [key, item] of Object.entries(value)) {
    if (key !== "__proto__" && !known.has(key)) {
      Object.defineProperty(appearance, key, { configurable: true, enumerable: true, value: item, writable: true });
    }
  }
  const strings = ["class", "fontWeight", "prefixValue", "css"];
  for (const key of strings) if (typeof value[key] === "string") appearance[key] = value[key];
  for (const key of ["color", "textColor"]) if (typeof value[key] === "string" || value[key] === null) appearance[key] = value[key];
  for (const key of ["italic", "underline", "hideText", "iconInheritColor", "backgroundIncludesMarker", "styleWholeLine"])
    if (typeof value[key] === "boolean") appearance[key] = value[key];
  if (validPrefixTypes.includes(value.prefixType as PrefixType)) appearance.prefixType = value.prefixType;
  for (const key of ["imageWidth", "imageHeight"]) if (isPositiveDimension(value[key])) appearance[key] = value[key];
  if (isRecord(value.prefixValues)) {
    const prefixValues: Partial<Record<PrefixType, string>> = {};
    for (const [type, prefixValue] of Object.entries(value.prefixValues))
      if (validPrefixTypes.includes(type as PrefixType) && typeof prefixValue === "string") prefixValues[type as PrefixType] = prefixValue;
    appearance.prefixValues = prefixValues;
  }
  return appearance;
}

function normalizeRuleGroups(value: unknown): Record<string, RuleGroup> {
  const groups = Object.create(null) as Record<string, RuleGroup>;
  if (!isRecord(value)) return groups;
  for (const [id, rawGroup] of Object.entries(value)) {
    if (!id.trim() || id === "__proto__" || !isRecord(rawGroup) || typeof rawGroup.name !== "string") continue;
    const group: RuleGroup = { name: rawGroup.name };
    if (typeof rawGroup.enabled === "boolean") group.enabled = rawGroup.enabled;
    if (typeof rawGroup.collapsed === "boolean") group.collapsed = rawGroup.collapsed;
    const style = normalizeRuleAppearance(rawGroup.style);
    if (style) group.style = style;
    groups[id] = group;
  }
  return groups;
}
