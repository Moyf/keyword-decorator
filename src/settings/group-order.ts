import type { StaticHighlightOptions } from "./settings";
import { repairGroupOrder, syncGroupedQueryOrder } from "./groups";

function orderedRuleIds(config: StaticHighlightOptions): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const id of config.queryOrder) {
    if (Object.prototype.hasOwnProperty.call(config.queries, id) && !seen.has(id)) {
      result.push(id);
      seen.add(id);
    }
  }
  for (const id of Object.keys(config.queries)) {
    if (!seen.has(id)) result.push(id);
  }
  return result;
}

function validGroupId(config: StaticHighlightOptions, groupId?: string): string | undefined {
  return groupId && Object.prototype.hasOwnProperty.call(config.groups ?? {}, groupId) ? groupId : undefined;
}

function ruleGroupId(config: StaticHighlightOptions, id: string): string | undefined {
  return validGroupId(config, config.queries[id].groupId);
}

/** Move a rule to a group, preserving the order of the other rules in every group. */
export function moveRuleToGroup(
  config: StaticHighlightOptions,
  id: string,
  groupId?: string,
  beforeId?: string,
): boolean {
  if (!Object.prototype.hasOwnProperty.call(config.queries, id)) return false;

  const targetGroupId = validGroupId(config, groupId);
  const rule = config.queries[id];
  const oldGroupId = rule.groupId;
  const previousOrder = [...config.queryOrder];
  const nextOrder = orderedRuleIds(config).filter(ruleId => ruleId !== id);

  if (targetGroupId === undefined) delete rule.groupId;
  else rule.groupId = targetGroupId;

  const validBeforeId = beforeId
    && beforeId !== id
    && Object.prototype.hasOwnProperty.call(config.queries, beforeId)
    && ruleGroupId(config, beforeId) === targetGroupId
    ? beforeId
    : undefined;
  let insertAt = validBeforeId ? nextOrder.indexOf(validBeforeId) : -1;
  if (insertAt < 0) {
    for (let index = nextOrder.length - 1; index >= 0; index--) {
      if (ruleGroupId(config, nextOrder[index]) === targetGroupId) {
        insertAt = index + 1;
        break;
      }
    }
  }
  if (insertAt < 0 && targetGroupId === undefined) {
    insertAt = nextOrder.findIndex(ruleId => ruleGroupId(config, ruleId) !== undefined);
    if (insertAt < 0) insertAt = nextOrder.length;
  } else if (insertAt < 0) {
    // An empty group is positioned by groupOrder; adding its first member keeps the rule list intact.
    insertAt = nextOrder.length;
  }
  nextOrder.splice(insertAt, 0, id);
  config.queryOrder.splice(0, config.queryOrder.length, ...nextOrder);
  syncGroupedQueryOrder(config);

  return oldGroupId !== rule.groupId || previousOrder.length !== config.queryOrder.length
    || previousOrder.some((ruleId, index) => config.queryOrder[index] !== ruleId);
}

/** Reorder one group relative to the repaired group order. */
export function moveRuleGroup(config: StaticHighlightOptions, id: string, beforeGroupId?: string): boolean {
  if (!Object.prototype.hasOwnProperty.call(config.groups ?? {}, id)) return false;

  const previousGroupOrder = [...(config.groupOrder ?? [])];
  const previousQueryOrder = [...config.queryOrder];
  const groupOrder = repairGroupOrder(config).filter(groupId => groupId !== id);
  const target = beforeGroupId && beforeGroupId !== id && groupOrder.includes(beforeGroupId)
    ? beforeGroupId
    : undefined;
  const insertAt = target ? groupOrder.indexOf(target) : groupOrder.length;
  groupOrder.splice(insertAt, 0, id);
  config.groupOrder = groupOrder;
  syncGroupedQueryOrder(config);

  return previousGroupOrder.length !== groupOrder.length
    || previousGroupOrder.some((groupId, index) => groupOrder[index] !== groupId)
    || previousQueryOrder.length !== config.queryOrder.length
    || previousQueryOrder.some((ruleId, index) => config.queryOrder[index] !== ruleId);
}
