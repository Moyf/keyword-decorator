import type { StaticHighlightOptions } from "./settings";

const EMOJI_PRESET = "emoji-shortcodes";

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
