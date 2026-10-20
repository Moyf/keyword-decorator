// Data tests import modal modules, but never construct these UI classes.
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
