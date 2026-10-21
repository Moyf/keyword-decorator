# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### ⚠️ Breaking Changes

- **Obsidian compatibility**: Require Obsidian 1.8.7 or later; update Obsidian before installing this update.

### 🚀 Added

- **Source mode toggle**: Keep source mode undecorated by default, with an opt-in setting that preserves the same content exclusions as Live Preview.

- **Emoji shortcodes**: Add a default group with 1,914 offline Unicode aliases, including `:happy:`, using one matcher; preserve existing rule priority and preset edits across reload and import/export, and support hiding emoji shortcode text with cursor recovery.

- **Rule workbench**: Manage rules with automatic saving, master and per-rule switches, filtering, duplication, reordering and deletion undo, in a responsive layout with independently scrolling panes.
- **Groups and inheritance**: Organize rules into collapsible groups, enable or disable a group together, share appearance with per-rule overrides, and reorder whole groups by dragging or with Move up / Move down buttons.
- **Bulk rule management**: Preview and add rules from keyword lines, spreadsheet columns or JSON, reuse the selected appearance, and import/export rules with their order and groups preserved.
- **Image and icon markers**: Search Lucide icons and vault images, use HTTP/HTTPS image URLs or pasted SVG, adjust dimensions and hide matched text; source text remains editable and returns when an image fails.

### ⚡ Changed

- **Matching and line styles**: Use one Keywords field for one or several lines, with legacy rule semantics preserved. Apply appearance to a whole logical line, and match regex `^` / `$` consistently in editing and reading views.

### 🐛 Fixed

- **Decoration boundaries**: Limit decorations and custom CSS to Markdown note bodies. Exclude link labels and destinations, code, math, properties, tags, embeds and other rendered UI, including when applying whole-line styles.

<details>
<summary>中文说明（点击展开）</summary>

### ⚠️ 破坏性变更

- **Obsidian 兼容性**：最低要求调整为 Obsidian 1.8.7，请先更新 Obsidian 再安装本次更新。

### 🚀 新增

- **源码视图开关**：源码模式默认保留原文，可通过「对源码视图添加装饰」单独开启，并沿用实时预览的内容排除规则。

- **Emoji 短码**：新增含 1,914 个离线 Unicode 别名的默认分组，支持 `:happy:`，整套字典共用一条匹配规则；保留现有优先级、预设编辑及导入导出状态，支持隐藏短码文字并在光标移入时恢复原文。

- **规则工作台**：支持自动保存、总开关和单规则开关、筛选、复制、排序和删除撤销；采用响应布局，列表与编辑区独立滚动。
- **分组与继承**：支持可折叠分组、整组启停、共享外观及单规则覆盖；可拖动整组排序，也可使用「上移／下移」按钮。
- **批量规则管理**：通过关键词行、表格列或 JSON 预览并添加规则，可复用所选外观；导入导出保留规则顺序与分组。
- **图片与图标装饰**：支持搜索 Lucide 图标和库内图片、HTTP／HTTPS 图片链接、粘贴 SVG、尺寸设置与隐藏匹配文字；原文仍可编辑，图片失败时恢复显示。

### ⚡ 调整

- **匹配与整行样式**：统一使用「关键词」字段填写一行或多行，保留旧规则的匹配含义；支持整行外观，编辑和阅读视图中的正则 `^`／`$` 均按逻辑行匹配。

### 🐛 修复

- **装饰范围**：将装饰和自定义 CSS 限定在 Markdown 笔记正文，排除链接显示文本与网址、代码、公式、属性、标签、嵌入及其他界面；整行样式同样跳过这些内容。

</details>
