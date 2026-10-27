// Minimal host APIs for data tests and real-DOM integration fixtures.
// Matching, source mapping and settings behavior stay in the production modules.
import { StateField } from "@codemirror/state";

export class MarkdownView {}
export const editorInfoField = StateField.define({ create: () => new MarkdownView(), update: value => value });
export const editorLivePreviewField = StateField.define({ create: () => true, update: value => value });

export class Modal {
  constructor(_app?: unknown) {
    void _app;
  }
}

export class Setting {}

export class Plugin { constructor(public app: unknown) {} }
export class PluginSettingTab {}
export class SettingPage {}
export class Scope {}
export class MarkdownRenderChild {}
export class TAbstractFile {}
export class TFile extends TAbstractFile {}
export class AbstractInputSuggest {}
export class FuzzySuggestModal {}

export class ButtonComponent {
  buttonEl: HTMLButtonElement;
  constructor(parent: HTMLElement) { this.buttonEl = parent.createEl("button"); }
  setIcon(icon: string) { this.buttonEl.dataset.icon = icon; return this; }
  setTooltip(text: string) { this.buttonEl.title = text; return this; }
  setDisabled(value: boolean) { this.buttonEl.disabled = value; return this; }
  onClick(callback: () => void) { this.buttonEl.addEventListener("click", callback); return this; }
}
export class ToggleComponent {
  toggleEl: HTMLInputElement;
  constructor(parent: HTMLElement) { this.toggleEl = parent.createEl("input", { type: "checkbox" }); }
  setValue(value: boolean) { this.toggleEl.checked = value; return this; }
  onChange(callback: (value: boolean) => void) { this.toggleEl.addEventListener("change", () => callback(this.toggleEl.checked)); return this; }
}
class TestTextComponent<T extends HTMLInputElement | HTMLTextAreaElement> {
  constructor(public inputEl: T) {}
  setValue(value: string) { this.inputEl.value = value; return this; }
  setPlaceholder(value: string) { this.inputEl.placeholder = value; return this; }
  onChange(callback: (value: string) => void) { this.inputEl.addEventListener("input", () => callback(this.inputEl.value)); return this; }
}
export class TextComponent extends TestTextComponent<HTMLInputElement> {
  constructor(parent: HTMLElement) { super(parent.createEl("input")); }
}
export class DropdownComponent {}
export class TextAreaComponent extends TestTextComponent<HTMLTextAreaElement> {
  constructor(parent: HTMLElement) { super(parent.createEl("textarea")); }
}
export function setIcon(element: HTMLElement, icon: string) { element.dataset.icon = icon; }
export function getIcon() { return null; }
export function getIconIds(): string[] { return []; }
export function addIcon(id: string, svg: string) { void id; void svg; }
export class Notice { hide() {} }

export function getLanguage(): string {
  return "en";
}

export function requireApiVersion(): boolean {
  return true;
}
