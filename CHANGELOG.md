# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### 🚀 Added

- **Rule workbench**: Add automatic saving, a master switch, per-rule toggles, drag and keyboard reordering, duplication, filtering, and deletion undo.
- **Bulk rules**: Preview and add independent rules from keyword lines, tab-separated spreadsheet columns, or JSON; optionally inherit the selected rule's appearance.
- **Image markers**: Paste SVG code, pick vault images with thumbnail search, configure image dimensions, and optionally hide matched text while preserving editable source.
- **Network images**: Add a dedicated HTTP/HTTPS image URL source with live preview, preserved URL query parameters, size controls, and image-only display.
- **Groups and inheritance**: Collapse, toggle and reorder groups; move rules between them and inherit unset appearance fields with individual overrides and reset controls.
- **Appearance controls**: Add optional whole-line styling, marker backgrounds, default Lucide text-color inheritance, searchable icon previews, per-type marker caches and a scoped Custom CSS example.

### ⚡ Changed

- **Settings fixes**: Fill the available width when the editor is collapsed, remove the blank-list tooltip, recover cross-window dragging, show marker-background options only with an enabled background, and reduce rule corner rounding.

- **Keyword matching**: Combine the single/multiple keyword controls into Keywords (one per line), retaining legacy matching semantics and the separate regular-expression mode.

- **Responsive layout**: Use equal columns with independent pane scrolling, surrounding spacing and an editor-collapse action; keep two columns down to 360 CSS px of panel width.
- **Line anchors**: Match regex `^` and `$` against logical lines in both views, without treating inline formatting or a clipped viewport as a new line.
- **Settings dialogs**: Give import, export and bulk add compact footers and automatic previews; show empty-replacement confirmation only when needed and group advanced fields in an icon disclosure.
- **Persistence and rendering**: Preserve legacy settings and import formats, export rule order, cache rule compilation and image resolution, and limit editor matching to visible content.

<details>
<summary>中文说明（点击展开）</summary>

### 🚀 新增

- **规则工作台**：支持自动保存、总开关、单规则开关、拖动及键盘排序、复制、筛选和删除撤销。
- **批量规则**：通过关键词行、表格制表符分列或 JSON 预览并添加独立规则，可选继承所选规则的外观。
- **图片装饰**：支持粘贴 SVG、带缩略图搜索的库内图片选择、图片尺寸，以及隐藏匹配文字并保留可编辑原文。
- **网络图片**：新增 HTTP／HTTPS 图片链接类型，支持即时预览、保留 URL 查询参数、尺寸调整和只显示图片。
- **分组与继承**：支持折叠、整组开关、整组排序及组间移动规则；未配置的外观继承分组，支持逐项覆盖和恢复继承。
- **外观控制**：增加整行样式、前缀背景、Lucide 默认继承文字颜色、图标搜索预览、各类型独立缓存和 Custom CSS 示例。

### ⚡ 调整

- **关键词匹配**：合并单关键词和多关键词控件为「关键词（每行一个）」，保留旧规则的匹配含义和独立正则模式。

- **响应布局**：左右列宽改为 1:1，增加周边留白和收起设置按钮；双栏独立滚动，面板达到 360 CSS px 即保留双栏。
- **行首正则**：编辑和阅读视图均按逻辑行处理 `^`／`$`，不会将行内格式或视口裁切位置误当行首。
- **设置弹窗**：导入、导出和批量添加统一为紧凑操作栏及自动预览；清空确认仅按需显示，高级字段改为带图标的折叠分组。
- **保存与渲染**：保留旧设置与导入格式，导出规则顺序，缓存匹配规则编译和图片解析，并只匹配编辑器可见区域。

</details>
