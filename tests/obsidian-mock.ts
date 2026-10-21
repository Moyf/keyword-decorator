// Data tests import modal modules, but never construct these UI classes.
import { StateField } from "@codemirror/state";

export class MarkdownView {}
export const editorInfoField = StateField.define({ create: () => new MarkdownView(), update: value => value });
export const editorViewField = editorInfoField;
export const editorLivePreviewField = StateField.define({ create: () => true, update: value => value });

export class Modal {
  constructor(_app?: unknown) {
    void _app;
  }
}

export class Setting {}

export class ButtonComponent {}
export class DropdownComponent {}
export class TextAreaComponent {}

export function getLanguage(): string {
  return "en";
}

export function requireApiVersion(): boolean {
  return true;
}
