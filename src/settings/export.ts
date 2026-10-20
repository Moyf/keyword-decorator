// Adapted from https://github.com/mgmeyers/obsidian-style-setting

import { App, ButtonComponent, Modal, TextAreaComponent } from "obsidian";
import { localize, t } from "../i18n";
import type DynamicHighlightsPlugin from "../main";
import { DynamicHighlightsSettings, SearchQueries } from "./settings";


export class ExportModal extends Modal {
  plugin: DynamicHighlightsPlugin;
  section: string;
  config: SearchQueries;
  settings?: DynamicHighlightsSettings;

  constructor(app: App, plugin: DynamicHighlightsPlugin, section: string, config: SearchQueries, settings?: DynamicHighlightsSettings) {
    super(app);
    this.plugin = plugin;
    this.config = config;
    this.section = section;
    this.settings = settings;
  }

  /** Omitting settings preserves the original query-map export format. */
  static serialize(config: SearchQueries, settings?: DynamicHighlightsSettings): string {
    if (!settings) return JSON.stringify(config, null, 2);
    const queries = config;
    const queryOrder = settings.staticHighlighter.queryOrder.filter(id => Object.prototype.hasOwnProperty.call(queries, id));
    for (const id of Object.keys(queries)) if (!queryOrder.includes(id)) queryOrder.push(id);
    return JSON.stringify({
      enabled: settings.enabled,
      staticHighlighter: {
        queries,
        queryOrder,
        groups: settings.staticHighlighter.groups ?? {},
        groupOrder: settings.staticHighlighter.groupOrder ?? [],
        installedPresets: settings.staticHighlighter.installedPresets ?? [],
      },
    }, null, 2);
  }

  onOpen() {
    const { contentEl, modalEl } = this;
    this.setTitle(t("export"));
    modalEl.addClass("modal-dynamic-highlights");
    contentEl.createEl("p", {
      cls: "kd-dialog-description",
      text: localize("Export these rules as JSON.", "将这些规则导出为 JSON。"),
    });
    const body = contentEl.createDiv({ cls: "kd-dialog-body" });
    const output = ExportModal.serialize(this.config, this.settings);
    const textarea = new TextAreaComponent(body);
    textarea.inputEl.addClass("kd-dialog-input");
    textarea.inputEl.setAttribute("aria-label", localize("Exported rules JSON", "导出规则 JSON"));
    textarea.inputEl.setAttribute("readonly", "true");
    textarea.setValue(output);

    const footer = contentEl.createDiv({ cls: "kd-dialog-footer" });
    const copyButton = new ButtonComponent(footer)
      .setButtonText(localize("Copy", "复制"))
      .onClick(async () => {
        const clipboard = contentEl.ownerDocument.defaultView?.navigator.clipboard;
        if (!clipboard) {
          copyButton.setButtonText(localize("Clipboard unavailable", "剪贴板不可用"));
          return;
        }
        try {
          await clipboard.writeText(textarea.getValue());
          copyButton.setButtonText(localize("Copied", "已复制"));
          copyButton.buttonEl.addClass("success");
          const view = contentEl.ownerDocument.defaultView;
          view?.setTimeout(() => {
            if (copyButton.buttonEl.isConnected) {
              copyButton.buttonEl.removeClass("success");
              copyButton.setButtonText(localize("Copy", "复制"));
            }
          }, 2000);
        } catch {
          copyButton.setButtonText(localize("Copy failed", "复制失败"));
        }
      });
    footer.createEl("a", {
      cls: "kd-dialog-download",
      text: localize("Download", "下载"),
      attr: {
        download: "keyword-decorator.json",
        href: `data:application/json;charset=utf-8,${encodeURIComponent(output)}`,
      },
    });
    new ButtonComponent(footer).setButtonText(localize("Done", "完成")).onClick(() => this.close());
  }

  onClose() {
    let { contentEl } = this;
    contentEl.empty();
  }
}
