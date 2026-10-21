import { AbstractInputSuggest, App, FuzzySuggestModal, TFile } from "obsidian";
import { t } from "../i18n";

const extensions = new Set(["png", "jpg", "jpeg", "gif", "bmp", "webp", "svg", "avif"]);
export class ImageSuggest extends AbstractInputSuggest<TFile> {
  private files: TFile[];
  constructor(app: App, private input: HTMLInputElement) {
    super(app, input);
    this.files = app.vault.getFiles().filter(file => extensions.has(file.extension.toLowerCase()));
  }
  protected getSuggestions(query: string) {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    return this.files.filter(file => terms.every(term => file.path.toLowerCase().includes(term))).slice(0, 50);
  }
  renderSuggestion(file: TFile, el: HTMLElement) { imageOption(el, this.app, file); }
  selectSuggestion(file: TFile) {
    this.setValue(file.path); this.input.dispatchEvent(new Event("input", { bubbles: true })); this.close();
  }
}
function imageOption(el: HTMLElement, app: App, file: TFile) {
  el.addClass("kd-image-option");
  const img = el.createEl("img", { attr: { src: app.vault.getResourcePath(file), alt: "", loading: "lazy" } });
  img.addClass("kd-image-thumbnail");
  const text = el.createDiv(); text.createDiv({ text: file.name }); text.createDiv({ cls: "kd-caption", text: file.path });
}
export class ImagePicker extends FuzzySuggestModal<TFile> {
  private files: TFile[];
  constructor(app: App, private choose: (file: TFile) => void) {
    super(app); this.setPlaceholder(t("imageSearch"));
    this.files = app.vault.getFiles().filter(file => extensions.has(file.extension.toLowerCase()));
  }
  getItems() { return this.files; }
  getItemText(file: TFile) { return file.path; }
  renderSuggestion(result: { item: TFile }, el: HTMLElement) { imageOption(el, this.app, result.item); }
  onChooseItem(file: TFile) { this.choose(file); }
}
