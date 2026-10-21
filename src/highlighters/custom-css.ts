import { EDITOR_BODY_SELECTOR, READING_BODY_SELECTOR } from "./scope";

export function scopeCustomCSS(css: string, ownerDocument: Document): string {
  // Parse in a detached document so unscoped rules never enter the app stylesheet.
  const parsingDocument = ownerDocument.implementation.createHTMLDocument("");
  const style = parsingDocument.adoptNode(createEl("style"));
  style.textContent = css;
  parsingDocument.head.appendChild(style);
  return style.sheet ? scopeRules(style.sheet.cssRules) : "";
}

function scopeRules(rules: CSSRuleList): string {
  return Array.from(rules).map(rule => {
    if ("selectorText" in rule && "style" in rule) {
      const styleRule = rule as CSSStyleRule;
      const selectors = splitSelectors(styleRule.selectorText);
      const scoped = [EDITOR_BODY_SELECTOR, READING_BODY_SELECTOR]
        .reduce<string[]>((all, scope) => all.concat(selectors.map(selector => `${scope} ${selector}`)), []);
      return `${scoped.join(", ")} { ${styleRule.style.cssText} }`;
    }
    // Keep conditional styles scoped, and ignore global directives such as
    // @import, @font-face and @keyframes that can affect the rest of the app.
    if (/^@(media|supports|container|layer)\b/.test(rule.cssText) && "cssRules" in rule) {
      const group = rule as CSSGroupingRule;
      const header = rule.cssText.slice(0, rule.cssText.indexOf("{"));
      return `${header}{ ${scopeRules(group.cssRules)} }`;
    }
    return "";
  }).join("\n");
}

function splitSelectors(value: string): string[] {
  const selectors: string[] = [];
  let start = 0, depth = 0, quote = "", escaped = false;
  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    if (escaped) { escaped = false; continue; }
    if (char === "\\") { escaped = true; continue; }
    if (quote) { if (char === quote) quote = ""; continue; }
    if (char === '"' || char === "'") { quote = char; continue; }
    if (char === "(" || char === "[") depth++;
    else if (char === ")" || char === "]") depth--;
    else if (char === "," && depth === 0) {
      selectors.push(value.slice(start, i).trim());
      start = i + 1;
    }
  }
  selectors.push(value.slice(start).trim());
  return selectors;
}
