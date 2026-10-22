import { lookupEmojiShortcode } from "../emoji/shortcodes";

export interface MatchRule {
  query: string;
  queryMode?: "keywords" | "single" | "multiple" | "regex" | "emoji-shortcodes";
  regex?: boolean;
  enabled?: boolean;
  hideText?: boolean;
  styleWholeLine?: boolean;
}

export interface CompiledRule {
  ruleId: string;
  priority: number;
  rule: MatchRule;
  mode: "keywords" | "single" | "multiple" | "regex" | "emoji-shortcodes";
  terms: string[];
  expression?: RegExp;
}

export interface TextMatch {
  from: number;
  to: number;
  ruleId: string;
  priority: number;
  rule: MatchRule;
}

export const MAX_REGEX_PATTERN_LENGTH = 16384;
const MAX_CANDIDATES_PER_TEXT = 5000;
const MAX_MATCHES_PER_RULE = 1000;

export function compileRules(queries: Record<string, MatchRule>, queryOrder: string[]): CompiledRule[] {
  const compiled: CompiledRule[] = [];
  queryOrder.forEach((ruleId, priority) => {
    const rule = queries[ruleId];
    if (!rule || rule.enabled === false || (!rule.query?.trim() && rule.queryMode !== "emoji-shortcodes")) return;
    const mode = rule.queryMode || (rule.regex ? "regex" : "single");
    const entry: CompiledRule = { ruleId, priority, rule, mode, terms: [] };
    if (mode === "multiple" || mode === "keywords") {
      entry.terms = rule.query.split(mode === "multiple" ? /[\n,]/g : /\r?\n/g).map(term => term.trim()).filter(Boolean).slice(0, 1000);
    } else if (mode === "emoji-shortcodes") {
      entry.expression = /:[a-z0-9_+-]+:/g;
    } else if (mode === "regex") {
      // Limit pattern size; JavaScript RegExp has no safe in-thread timeout for catastrophic backtracking.
      if (rule.query.length > MAX_REGEX_PATTERN_LENGTH) return;
      try {
        // `m` makes anchors refer to logical lines in the complete document,
        // while the matcher still returns offsets into the original text.
        entry.expression = new RegExp(rule.query, "gm");
      } catch {
        return;
      }
    } else {
      entry.terms = [rule.query];
    }
    compiled.push(entry);
  });
  return compiled;
}

export function findMatches(text: string, rules: CompiledRule[], accepts?: (match: TextMatch) => boolean): TextMatch[] {
  const candidates: TextMatch[] = [];
  for (const item of rules) {
    if (candidates.length >= MAX_CANDIDATES_PER_TEXT) break;
    if (item.mode === "regex" || item.mode === "emoji-shortcodes") {
      const expression = item.expression;
      if (!expression) continue;
      expression.lastIndex = 0;
      let match: RegExpExecArray | null;
      let matchesForRule = 0;
      while ((match = expression.exec(text)) && candidates.length < MAX_CANDIDATES_PER_TEXT && matchesForRule < MAX_MATCHES_PER_RULE) {
        if (match[0].length) {
          const emoji = item.mode === "emoji-shortcodes" ? lookupEmojiShortcode(match[0]) : undefined;
          if (item.mode === "emoji-shortcodes" && !emoji) {
            // The closing colon may open a known shortcode immediately after an unknown one.
            expression.lastIndex--;
            continue;
          }
          const rule = emoji ? { ...item.rule, prefixType: "emoji", prefixValue: emoji } : item.rule;
          candidates.push({ from: match.index, to: match.index + match[0].length, ruleId: item.ruleId, priority: item.priority, rule });
          matchesForRule++;
        } else if (expression.lastIndex === match.index) {
          expression.lastIndex++;
        }
      }
      continue;
    }
    let matchesForRule = 0;
    for (const term of item.terms) {
      let from = text.indexOf(term);
      while (from !== -1 && candidates.length < MAX_CANDIDATES_PER_TEXT && matchesForRule < MAX_MATCHES_PER_RULE) {
        candidates.push({ from, to: from + term.length, ruleId: item.ruleId, priority: item.priority, rule: item.rule });
        matchesForRule++;
        from = text.indexOf(term, from + term.length);
      }
    }
  }

  candidates.sort((a, b) => a.priority - b.priority || a.from - b.from || b.to - a.to);
  const selected: TextMatch[] = [];
  for (const match of candidates) {
    // Protected content cannot suppress an eligible lower-priority match.
    if (accepts && !accepts(match)) continue;
    let low = 0;
    let high = selected.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (selected[middle].from < match.from) low = middle + 1;
      else high = middle;
    }
    const before = selected[low - 1];
    const after = selected[low];
    if ((before && before.to > match.from) || (after && after.from < match.to)) continue;
    selected.splice(low, 0, match);
  }
  return selected;
}

/** Match visible offsets against complete logical lines so clipped ranges cannot invent ^/$ boundaries. */
export function findMatchesInRanges(text: string, ranges: readonly { from: number; to: number }[], rules: CompiledRule[], accepts?: (match: TextMatch) => boolean): TextMatch[] {
  const visible = ranges.filter(range => range.to > range.from);
  const scan = visible.map(range => {
    const from = range.from <= 0 ? 0 : text.lastIndexOf("\n", range.from - 1) + 1;
    const newline = text.indexOf("\n", range.to);
    const to = newline < 0 ? text.length : newline + 1;
    return { from, to };
  }).sort((a, b) => a.from - b.from);
  const merged: { from: number; to: number }[] = [];
  for (const range of scan) {
    const previous = merged[merged.length - 1];
    if (previous && range.from <= previous.to) previous.to = Math.max(previous.to, range.to);
    else merged.push({ ...range });
  }
  const found = new Map<string, TextMatch>();
  for (const range of merged) {
    for (const match of findMatches(text.slice(range.from, range.to), rules,
      accepts ? match => accepts({ ...match, from: range.from + match.from, to: range.from + match.to }) : undefined)) {
      const from = range.from + match.from;
      const to = range.from + match.to;
      if (!visible.some(item => from < item.to && to > item.from)) continue;
      found.set(`${match.ruleId}:${from}:${to}`, { ...match, from, to });
    }
  }
  return Array.from(found.values()).sort((a, b) => a.priority - b.priority || a.from - b.from || b.to - a.to);
}
