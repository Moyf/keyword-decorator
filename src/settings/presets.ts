import type { SearchQuery, StaticHighlightOptions } from "./settings";

const EMOJI_PRESET = "emoji-shortcodes";

/** Recognize existing preset exports without rewriting IDs, appearance or disabled state. */
export function getBuiltinEmojiGroup(config: StaticHighlightOptions, groupId?: string): { ruleId: string; rule: SearchQuery } | undefined {
  if (!groupId || !Object.prototype.hasOwnProperty.call(config.groups ?? {}, groupId)) return undefined;
  const members = Object.entries(config.queries).filter(([, rule]) => rule.groupId === groupId);
  if (members.length !== 1 || members[0][1].queryMode !== EMOJI_PRESET) return undefined;
  return { ruleId: members[0][0], rule: members[0][1] };
}

/** A built-in group exposes one switch, including legacy per-rule disabled state. */
export function setBuiltinEmojiEnabled(config: StaticHighlightOptions, groupId: string, enabled: boolean): void {
  const builtin = getBuiltinEmojiGroup(config, groupId);
  if (!builtin) return;
  config.groups![groupId].enabled = enabled;
  builtin.rule.enabled = enabled;
}

/** Install once, appending after existing rules and preserving later edits or deletion. */
export function installDefaultPresets(config: StaticHighlightOptions): boolean {
  if (config.installedPresets?.includes(EMOJI_PRESET)) return false;
  config.groups ??= {};
  config.groupOrder ??= [];
  const availableId = (base: string, records: object) => {
    let id = base;
    for (let suffix = 2; Object.prototype.hasOwnProperty.call(records, id); suffix++) id = `${base}-${suffix}`;
    return id;
  };
  const groupId = availableId("preset-emoji-shortcodes", config.groups);
  const ruleId = availableId("preset-emoji-shortcodes", config.queries);
  config.groups[groupId] = { name: "Emoji shortcodes", enabled: true, collapsed: true, style: { hideText: true } };
  config.groupOrder.push(groupId);
  config.queries[ruleId] = {
    name: "Emoji shortcodes", query: ":smile:", queryMode: "emoji-shortcodes", regex: false, enabled: true, groupId,
  };
  config.queryOrder.push(ruleId);
  config.installedPresets = [...(config.installedPresets ?? []), EMOJI_PRESET];
  return true;
}
