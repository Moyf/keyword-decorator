import type { RuleAppearance, RuleGroup, SearchQueries, SearchQuery, StaticHighlightOptions } from "./settings";

export const appearanceKeys = [
  "class", "color", "textColor", "fontWeight", "italic", "underline", "prefixType", "prefixValue", "prefixValues", "css",
  "hideText", "imageWidth", "imageHeight", "imageCornerRadius", "iconInheritColor", "backgroundIncludesMarker", "styleWholeLine",
  "decorateOnce",
] as const as readonly (keyof RuleAppearance)[];

/** Return a display-ready rule without changing the stored rule or group style. */
export function getEffectiveRule(rule: SearchQuery, groups?: Record<string, RuleGroup>): SearchQuery {
  const group = rule.groupId ? groups?.[rule.groupId] : undefined;
  const definedRuleFields = Object.fromEntries(
    Object.entries(rule).filter(([, value]) => value !== undefined),
  );
  const effective = { ...(group?.style ?? {}), ...definedRuleFields } as SearchQuery;
  effective.enabled = rule.enabled !== false && group?.enabled !== false;
  effective.iconInheritColor ??= true;
  effective.backgroundIncludesMarker ??= false;
  effective.styleWholeLine ??= false;
  effective.decorateOnce ??= false;
  return effective;
}

export function getEffectiveQueries(config: StaticHighlightOptions): SearchQueries {
  const queries = Object.create(null) as SearchQueries;
  for (const [id, rule] of Object.entries(config.queries)) queries[id] = getEffectiveRule(rule, config.groups);
  return queries;
}

/** Return a valid group order containing each group exactly once. */
export function repairGroupOrder(config: StaticHighlightOptions): string[] {
  const groups = config.groups ?? {};
  const result: string[] = [];
  const seen = new Set<string>();
  for (const id of config.groupOrder ?? []) {
    if (typeof id === "string" && Object.prototype.hasOwnProperty.call(groups, id) && !seen.has(id)) {
      result.push(id);
      seen.add(id);
    }
  }
  for (const id of Object.keys(groups)) if (!seen.has(id)) result.push(id);
  return result;
}

/** Sort ungrouped rules first, then each group's rules, preserving member order. */
export function syncGroupedQueryOrder(config: StaticHighlightOptions): void {
  const validGroups = config.groups ?? {};
  const groupOrder = repairGroupOrder(config);
  const rank = new Map(groupOrder.map((id, index) => [id, index]));
  const originalOrder = [...config.queryOrder];
  const seen = new Set<string>();
  for (const id of Object.keys(config.queries)) if (!originalOrder.includes(id)) originalOrder.push(id);
  const orderedIds = originalOrder.filter(id => {
    if (!Object.prototype.hasOwnProperty.call(config.queries, id) || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  const groupFor = (id: string) => {
    const groupId = config.queries[id].groupId;
    return groupId && Object.prototype.hasOwnProperty.call(validGroups, groupId) ? groupId : undefined;
  };
  orderedIds.sort((left, right) => {
    const leftGroup = groupFor(left);
    const rightGroup = groupFor(right);
    if (!leftGroup) return rightGroup ? -1 : 0;
    if (!rightGroup) return 1;
    return (rank.get(leftGroup) ?? Number.MAX_SAFE_INTEGER) - (rank.get(rightGroup) ?? Number.MAX_SAFE_INTEGER);
  });
  config.queryOrder.splice(0, config.queryOrder.length, ...orderedIds);
}

export function clearRuleAppearance(rule: SearchQuery): void {
  for (const key of appearanceKeys) delete rule[key];
}
