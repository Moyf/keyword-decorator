import { parseHTML } from "linkedom";

interface ElementOptions { cls?: string; text?: string; value?: string; type?: string; attr?: Record<string, string> }

/** A real DOM plus the small set of Obsidian DOM conveniences used by the UI. */
export function createTestDocument() {
  const { window } = parseHTML("<!doctype html><html><head></head><body></body></html>");
  const doc = window.document;
  function create<K extends keyof HTMLElementTagNameMap>(parent: HTMLElement, tag: K, options: ElementOptions | string = {}) {
    const el = doc.createElement(tag);
    const settings = typeof options === "string" ? { cls: options } : options;
    if (settings.cls) el.className = settings.cls;
    if (settings.text) el.textContent = settings.text;
    if (settings.value !== undefined) el.setAttribute("value", settings.value);
    if (settings.type) el.setAttribute("type", settings.type);
    for (const [name, value] of Object.entries(settings.attr || {})) el.setAttribute(name, value);
    parent.appendChild(el);
    return el;
  }
  Object.assign(window.HTMLElement.prototype, {
    createEl(this: HTMLElement, tag: keyof HTMLElementTagNameMap, options?: ElementOptions) { return create(this, tag, options); },
    createDiv(this: HTMLElement, options?: ElementOptions | string) { return create(this, "div", options); },
    createSpan(this: HTMLElement, options?: ElementOptions | string) { return create(this, "span", options); },
    addClass(this: HTMLElement, ...names: string[]) { this.classList.add(...names); },
    removeClass(this: HTMLElement, ...names: string[]) { this.classList.remove(...names); },
    toggleClass(this: HTMLElement, name: string, enabled: boolean) { this.classList.toggle(name, enabled); },
    empty(this: HTMLElement) { this.replaceChildren(); },
    setText(this: HTMLElement, text: string) { this.textContent = text; },
    setCssProps(this: HTMLElement, props: Record<string, string>) {
      for (const [key, value] of Object.entries(props)) this.style.setProperty(key, value);
    },
  });
  // All fixture nodes already belong to this document.
  Object.defineProperty(doc, "adoptNode", { value: (node: Node) => node });
  Object.assign(globalThis, {
    createSpan: () => doc.createElement("span"),
    createFragment: () => doc.createDocumentFragment(),
  });
  return { window, document: doc };
}
