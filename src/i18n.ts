import { getLanguage, requireApiVersion } from "obsidian";

const en = {
  enabled: "Enable decorations", enabledDesc: "Apply rules in the editor and reading view.",
  rules: "Rules", newRule: "New rule", bulk: "Bulk add", import: "Import", export: "Export",
  search: "Filter rules…", empty: "Give your words a visual signature.", emptyDesc: "Create a rule or add several at once to get started.",
  noResults: "No matching rules", autosave: "Changes save automatically", saving: "Saving…", saved: "Saved", failed: "Could not save. Your changes are still here; edit again to retry.",
  back: "All rules", duplicate: "Duplicate", copy: "copy", delete: "Delete rule", undo: "Undo", deleted: "Rule deleted", up: "Move up", down: "Move down", drag: "Drag to reorder · Alt + ↑ / ↓",
  name: "Rule name", unnamed: "Untitled rule", namePlaceholder: "A name to find this rule later",
  matching: "Match", mode: "Match type", keywords: "Keywords (one per line)", single: "Single keyword", multiple: "Multiple keywords", regex: "Regular expression",
  query: "Keyword", queries: "Keywords", queryHint: "One keyword per line. A single line is enough; commas are matched as text.", regexHint: "Enter a pattern without / delimiters. Keep expressions simple to avoid slow matching.", invalidRegex: "Invalid regular expression. This rule will not run until fixed.",
  appearance: "Appearance", preview: "Live preview", previewText: "Preview text", textColor: "Text", background: "Background", bold: "Bold", italic: "Italic", underline: "Underline",
  marker: "Marker", markerType: "Type", none: "None", emoji: "Emoji", icon: "Lucide icon", image: "Vault image", svg: "SVG code", markerValue: "Value", svgHint: "Paste a complete <svg>…</svg>. Active content and external references are removed.",
  url: "Image URL", urlHint: "Paste an HTTP or HTTPS image URL. The image loads directly from its host.", invalidUrl: "Enter a valid HTTP or HTTPS image URL.",
  imageHint: "Choose an image in this vault, or enter its full vault path.", browse: "Browse images", imageSearch: "Search images by filename or path…", noImages: "No images found in this vault", width: "Width (px)", height: "Height (px)", size: "Image size", sizeHint: "1–512 px. Images keep their proportions inside this box.",
  hideText: "Hide matched text", hideDesc: "Show only the emoji, image or SVG. In the editor, move the cursor into a match to edit its original text.",
  advanced: "Advanced", cssClass: "CSS classes", css: "Custom CSS", priority: "Earlier rules win when matches overlap.", paused: "Decorations paused", pausedDesc: "Rules are saved. Turn on decorations to apply them.",
} as const;
export type MessageKey = keyof typeof en;
const zh: Record<MessageKey, string> = {
  enabled: "启用装饰", enabledDesc: "在编辑器和阅读视图中应用规则。", rules: "规则", newRule: "新建规则", bulk: "批量添加", import: "导入", export: "导出",
  search: "筛选规则…", empty: "给文字一个鲜明的标记。", emptyDesc: "新建一条规则，或一次添加多组规则。", noResults: "没有匹配的规则", autosave: "修改后自动保存", saving: "正在保存…", saved: "已保存", failed: "保存失败，修改仍保留在当前页面；再次编辑可重试。",
  back: "全部规则", duplicate: "创建副本", copy: "副本", delete: "删除规则", undo: "撤销", deleted: "规则已删除", up: "上移", down: "下移", drag: "拖动排序 · Alt + ↑ / ↓",
  name: "规则名称", unnamed: "未命名规则", namePlaceholder: "用一个名称方便以后查找", matching: "匹配", mode: "匹配方式", keywords: "关键词（每行一个）", single: "单个关键词", multiple: "多个关键词", regex: "正则表达式", query: "关键词", queries: "关键词列表", queryHint: "每行一个关键词，只有一行也可以；逗号会作为文字匹配。", regexHint: "填写表达式，不包含两侧的 /。请使用简单表达式，避免匹配缓慢。", invalidRegex: "正则表达式无效，修正后此规则才会生效。",
  appearance: "外观", preview: "即时预览", previewText: "预览文字", textColor: "文字", background: "背景", bold: "粗体", italic: "斜体", underline: "下划线",
  marker: "装饰标记", markerType: "类型", none: "无", emoji: "Emoji", icon: "Lucide 图标", image: "库内图片", svg: "SVG 代码", markerValue: "内容", svgHint: "粘贴完整的 <svg>…</svg> 代码。脚本和外部引用会被移除。", imageHint: "从库内选择图片，或填写完整库内路径。远程 URL 会连接至图片网站。", browse: "浏览图片", imageSearch: "搜索图片名称或路径…", noImages: "库内没有找到图片", width: "宽度（px）", height: "高度（px）", size: "图片大小", sizeHint: "1–512 px，图片在此范围内保持比例。", hideText: "隐藏匹配文字", hideDesc: "只显示 Emoji、图片或 SVG；编辑时将光标移入匹配处，即可编辑原文。",
  url: "网络图片", urlHint: "粘贴 HTTP 或 HTTPS 图片链接，图片将直接从对应网站加载。", invalidUrl: "请输入有效的 HTTP 或 HTTPS 图片链接。",
  advanced: "高级", cssClass: "CSS 类名", css: "自定义 CSS", priority: "规则重叠时，排在前面的优先。", paused: "装饰已暂停", pausedDesc: "规则仍会保存，开启总开关即可应用。",
};

export function t(key: MessageKey): string {
  return localize(en[key], zh[key]);
}

export function localize(english: string, chinese: string): string {
  const language = requireApiVersion("1.8.7") ? getLanguage() : "en";
  return language.startsWith("zh") ? chinese : english;
}
