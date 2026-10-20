import { AbstractInputSuggest, App, FuzzySuggestModal, getIconIds, setIcon } from "obsidian";
import { localize } from "../i18n";

const ICON_LIMIT = 60;

function normalize(value: string): string {
  return value.toLowerCase().replace(/[\s-]+/g, " ").trim();
}

function matches(query: string, id: string): boolean {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return true;
  const normalizedId = normalize(id);
  return normalizedQuery.split(/\s+/).every(term => normalizedId.includes(term));
}

function renderIconOption(id: string, el: HTMLElement): void {
  el.addClass("kd-icon-option");
  const preview = el.createSpan({ cls: "kd-icon-preview", attr: { "aria-hidden": "true" } });
  setIcon(preview, id);
  el.createSpan({ cls: "kd-icon-name", text: id });
}

export class IconSuggest extends AbstractInputSuggest<string> {
  private readonly iconIds: string[];

  constructor(app: App, private readonly input: HTMLInputElement, private readonly onChoose?: (id: string) => void) {
    super(app, input);
    this.iconIds = getIconIds();
    this.limit = ICON_LIMIT;
  }

  protected getSuggestions(query: string): string[] {
    const normalizedQuery = normalize(query);
    return this.iconIds
      .filter(id => matches(normalizedQuery, id))
      .sort((a, b) => {
        const normalizedA = normalize(a);
        const normalizedB = normalize(b);
        const startsA = normalizedA.startsWith(normalizedQuery) ? 0 : 1;
        const startsB = normalizedB.startsWith(normalizedQuery) ? 0 : 1;
        return startsA - startsB || a.localeCompare(b);
      })
      .slice(0, ICON_LIMIT);
  }

  renderSuggestion(id: string, el: HTMLElement): void {
    renderIconOption(id, el);
  }

  selectSuggestion(id: string): void {
    this.setValue(id);
    const EventConstructor = this.input.ownerDocument.defaultView?.Event ?? Event;
    this.input.dispatchEvent(new EventConstructor("input", { bubbles: true }));
    this.onChoose?.(id);
    this.close();
  }

  /** Close the popover when its owning settings row is removed or rerendered. */
  destroy(): void {
    this.close();
  }
}

export class IconPicker extends FuzzySuggestModal<string> {
  private readonly iconIds: string[];

  constructor(app: App, private readonly onChoose: (id: string) => void) {
    super(app);
    this.iconIds = getIconIds();
    this.setPlaceholder(localize("Search icons…", "搜索图标…"));
  }

  getItems(): string[] {
    return this.iconIds;
  }

  getItemText(id: string): string {
    return id;
  }

  renderSuggestion(result: { item: string }, el: HTMLElement): void {
    renderIconOption(result.item, el);
  }

  onChooseItem(id: string): void {
    this.onChoose(id);
  }
}
