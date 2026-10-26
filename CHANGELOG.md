# Changelog

All notable changes to this project will be documented in this file.

## [0.3.1] - 2026-10-26

### ⚠️ Breaking Changes

- **Obsidian compatibility**: Require Obsidian 1.8.7 or later; update Obsidian before installing this update.

### 🚀 Added

- **Source mode toggle**: Keep source mode undecorated by default, with an opt-in setting that preserves the same content exclusions as Live Preview.
- **Rule multi-selection**: Ctrl/Cmd-click to toggle rules, Shift-click for a visible range, and drag the selected rules together within or between groups while preserving their relative order.
- **Group transfer**: Export a single group with its rules and shared appearance, or append exported groups with collision-safe IDs. Import defaults to adding new content; existing rules, groups and the master switch stay unchanged in append mode.

- **Emoji shortcodes**: Add a dedicated built-in group with enable and hide-text switches for 1,914 offline aliases, including `:happy:`. Keep ordinary match types limited to keywords and regex; preserve existing preset settings, priority, import/export and cursor recovery.

- **Rule workbench**: Manage rules with automatic saving, master and per-rule switches, filtering, duplication, reordering and deletion undo, in a responsive layout with independently scrolling panes.
- **Groups and inheritance**: Organize rules into collapsible groups, enable or disable a group together, share appearance with per-rule overrides, and reorder whole groups by dragging or with Move up / Move down buttons.
- **Bulk rule management**: Preview and add rules from keyword lines, spreadsheet columns or JSON, reuse the selected appearance, and import/export rules with their order and groups preserved.
- **Image and icon markers**: Search Lucide icons and vault images, use HTTP/HTTPS image URLs or pasted SVG, adjust dimensions and hide matched text; source text remains editable and returns when an image fails.

### ⚡ Changed

- **Compact settings layout**: Keep icon buttons square and search fields fully visible, switch crowded panes to single-column navigation, reduce name and preview spacing, and place save status beside import/export. New rules focus the Keyword field.
- **Group navigation**: Preserve the list position when selecting groups, double-click names to fold or expand, and use insertion lines and target highlights while dragging. Keep required reorder scrolling smooth, honoring reduced motion.

- **Matching and line styles**: Use one Keywords field for one or several lines, with legacy rule semantics preserved. Apply appearance to a whole logical line, and match regex `^` / `$` consistently in editing and reading views.

### 🐛 Fixed

- **Decoration boundaries**: Limit decorations and custom CSS to Markdown note bodies. Exclude link labels and destinations, code, math, properties, tags, embeds and other rendered UI, including when applying whole-line styles.

<details>
<summary>中文说明（点击展开）</summary>

### ⚠️ 破坏性变更

- **Obsidian 兼容性**：最低要求调整为 Obsidian 1.8.7，请先更新 Obsidian 再安装本次更新。

### 🚀 新增

- **源码视图开关**：源码模式默认保留原文，可通过「对源码视图添加装饰」单独开启，并沿用实时预览的内容排除规则。
- **规则多选**：Ctrl/Cmd 点击切换选择，Shift 点击选择可见范围，支持整批拖动排序及跨分组移动，保留所选规则的相对顺序。
- **分组导入导出**：可单独导出分组、组内规则及共享样式，导入时追加新分组并处理 ID 冲突。普通导入默认追加，保留现有规则、分组及总开关。

- **Emoji 短码**：以特殊内置组提供 1,914 个离线别名（含 `:happy:`），独立控制整套启停及隐藏文字；普通匹配方式仅保留关键词和正则，兼容现有预设设置、优先级、导入导出及光标恢复。

- **规则工作台**：支持自动保存、总开关和单规则开关、筛选、复制、排序和删除撤销；采用响应布局，列表与编辑区独立滚动。
- **分组与继承**：支持可折叠分组、整组启停、共享外观及单规则覆盖；可拖动整组排序，也可使用「上移／下移」按钮。
- **批量规则管理**：通过关键词行、表格列或 JSON 预览并添加规则，可复用所选外观；导入导出保留规则顺序与分组。
- **图片与图标装饰**：支持搜索 Lucide 图标和库内图片、HTTP／HTTPS 图片链接、粘贴 SVG、尺寸设置与隐藏匹配文字；原文仍可编辑，图片失败时恢复显示。

### ⚡ 调整

- **紧凑设置布局**：图标按钮保持正方形，搜索框完整显示，空间不足时切换单列；缩小名称字号、收紧预览间距，并将保存状态移到导入导出按钮旁。新建规则直接聚焦「关键词」。
- **分组导航**：点击分组时保留列表位置，支持双击组名折叠和展开；拖动改用插入线和目标高亮，排序时必要的滚动采用平滑过渡，并尊重减少动态效果设置。

- **匹配与整行样式**：统一使用「关键词」字段填写一行或多行，保留旧规则的匹配含义；支持整行外观，编辑和阅读视图中的正则 `^`／`$` 均按逻辑行匹配。

### 🐛 修复

- **装饰范围**：将装饰和自定义 CSS 限定在 Markdown 笔记正文，排除链接显示文本与网址、代码、公式、属性、标签、嵌入及其他界面；整行样式同样跳过这些内容。

</details>
