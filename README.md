# Keyword Decorator

Give keywords a visual marker in Obsidian's editor and reading view. Rules can add text styles, emoji, Lucide icons, vault images, or pasted SVG artwork without changing your notes.

## Use

Open **Settings → Keyword Decorator** and create a rule. Choose **Keywords (one per line)** or **Regular expression**. One line matches one keyword; several lines share the same appearance. Changes save automatically; the preview updates as you type.

- Use the master switch to pause all decorations and each rule's switch to pause one rule.
- Drag a rule by its grip to change priority. You can also focus its grip and press `Alt + ↑ / ↓`, or use the editor's arrow buttons. Earlier rules win overlapping matches.
- Duplicate a rule to reuse its appearance. Deleting a rule offers a short undo action.
- Search the rule list by name or keyword. The list and editor use equal columns and scroll independently. Collapse the editor to browse only rules until you select one again. Below 360 CSS px of content width, selecting a rule opens its editor.

## Decoration boundaries

Decorations apply to Markdown note bodies in Live Preview and Reading view. Source mode shows the original text by default; enable **Decorate source mode** to opt in. Quick Switcher, suggestions, hover previews, settings and other rendered UI remain outside this scope.

Links are excluded, including their labels, destinations, wiki-link aliases, references and bare URLs. Code, math, properties, tags, embeds and Markdown formatting markers are also skipped. Headings, lists, quotes, callout prose and tables remain eligible. Whole-line appearance skips protected content on that line.

Custom CSS is scoped to the note body and to enabled decoration editors. Global directives such as `@import`, `@font-face` and `@keyframes` are ignored.

## Groups and appearance

Create groups with the folder-plus button. Fold a group, toggle all its rules together, drag rules between groups, or drag a group to move its rule block. The group editor also has Move up / Move down buttons; the first and last positions disable the unavailable direction. The rule editor has a Group selector. Ungrouped rules come first, followed by groups in list order; earlier rules win overlapping matches.

Click a group name to configure shared appearance. Unset rule fields inherit the group; explicit values, including disabled toggles or cleared colors, override it. Use ↶ beside a field to restore inheritance, or reset all appearance fields from the rule editor. Disabling a group preserves each rule's own switch. Full exports preserve groups, group order and appearance.

Lucide icons offer keyword suggestions with a preview and name. Icons inherit text color by default; this can be turned off. Each marker type remembers its own value. Background color can optionally include the prefix marker.

Advanced → **Apply style to the whole line** is off by default. Enable it to style the logical line containing a match, including text around the keyword. Soft wrapping does not split a logical line. If multiple whole-line rules match one line, the earliest rule supplies its appearance. Regular-expression `^` and `$` match each logical line.

Use `&` in Custom CSS to target this rule's matches, or the line when whole-line styling is enabled:

```css
& {
  border-bottom: 2px dashed currentColor;
  border-radius: 4px;
  padding: 0 4px;
}
```

## Emoji shortcodes

The default **Emoji shortcodes** group displays `:smile:` as 😄, `:heart:` as ❤️ and `:happy:` as 😄, in both the editor and reading view. Its single rule recognizes 1,914 aliases using a bundled local dictionary. No images, extra runtime dependency or network connection are required; appearance follows the device's emoji font. Unknown names stay unchanged. Discord server custom emoji and animated emoji are not included.

The group is enabled and collapsed initially. It is added once after existing rules, preserving their priority; renamed, disabled or deleted presets are not reset on reload. Switch off the group or rule to pause it. **Hide matched text** is enabled for this preset: move the cursor into a match to edit the original shortcode, or turn the switch off to show the emoji alongside its shortcode. Notes keep their original Markdown. You can also select **Emoji shortcodes** as a rule's match type.

The aliases come from [gemoji](https://github.com/github/gemoji), with an additional `happy` alias. See [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) for the pinned source and license.

## Images and SVG

Choose **Vault image** to search image names and full paths, with thumbnails. The picker saves the full vault path so files with identical names in different folders remain distinct. You can also enter a vault path or wikilink manually.

Choose **SVG code** and paste a complete `<svg>…</svg>` element. Active content and external references are removed before display. Configure width and height in pixels; images keep their proportions inside this box.

Choose **Image URL** to paste a direct HTTP or HTTPS image link, including URLs with query parameters. Network images share the same size and hide-text controls as vault images. The preview loads the image directly from its host, without sending a referrer. Invalid links and failed loads leave the original text readable.

**Hide matched text** is off by default for ordinary rules. For emoji, image and SVG markers, it leaves only the marker visible. Move the editor cursor into a match to reveal and edit its original text. The underlying Markdown is preserved.

The plugin runs locally. An image URL beginning with `https://` or `http://` connects to that image's host when displayed; using vault images or pasted SVG avoids these network requests. No account, telemetry, or paid service is required.

## Bulk add

Use the list's **Bulk add** button. Each line creates a separate rule:

```text
Obsidian
Review
Important
```

Paste tab-separated columns from a spreadsheet to give each rule its own name, keyword, and optional vault image:

```tsv
Name	Keyword	Image path (optional)
```

The first row is data too; omit column headings. A JSON rule array or previously exported rule package is also accepted. Preview the rule count and fix any errors before adding. You can optionally inherit the selected rule's appearance.

Several lines in a **Keywords** rule share one appearance. **Bulk add** creates independent rules that you can edit individually. Commas in the new Keywords mode are literal text; legacy comma-separated rules keep their original matching behavior and are displayed as separate lines when opened for editing.

## Import and export

Export copies or downloads a JSON package with rules, priority, and master-switch state. Older exports containing a map of rule IDs are also accepted. Import validates pasted JSON or a selected file automatically and offers a choice of merge or replace. The empty-replacement confirmation appears only when needed. Summaries and footer actions stay visible while editing.

## Performance

Editor matching is restricted to visible content. Matchers are compiled when rules change; saves are debounced and serialized. Image resolution is cached, and disabled rules skip matching. Avoid complex regular expressions: JavaScript cannot safely interrupt a pathological expression on the UI thread. See [DEVELOPMENT.md](DEVELOPMENT.md) for validation details and development commands.

## Development

```sh
npm install
```

Copy `.env.example` to `.env` and set `VAULT_PATH` to an existing Obsidian vault containing `.obsidian`. The copy script reads the process environment first, then `.env` files in the repository and parent directories. Relative vault paths resolve from the matching `.env` directory.

```sh
npm run test
npm run lint
npm run build:local
```

Build outputs are in `dist/`. Local builds copy only plugin assets, preserving the vault's existing `data.json`. Reload the plugin, then open its settings. Use `npm run build:local:set` to build and open settings when Hot Reload is active.

## 中文说明

装饰仅影响实时预览和阅读视图的 Markdown 笔记正文，不影响 Quick Switcher、建议列表、悬浮预览和设置等界面。源码模式默认显示原文，可通过「对源码视图添加装饰」单独开启。

链接的显示文本、网址、双链别名、引用和裸网址均不装饰；代码、公式、属性、标签、嵌入及格式标记也会跳过。标题、列表、引用、Callout 正文和表格仍可装饰，整行样式同样避开受保护内容。自定义 CSS 仅限正文范围，忽略全局指令。

默认分组 **Emoji shortcodes** 可将 `:smile:`、`:heart:`、`:happy:` 显示为对应的系统 Emoji。共支持 1,914 个别名，使用一条规则和本地字典，无需网络或图片素材；未知短码保留原样，不含 Discord 服务器自定义表情及动图。该分组首次启用时追加到现有规则之后，默认开启并收起；后续重载会保留改名、关闭和删除操作。预设默认隐藏短码文字，光标移入即可编辑原文；关闭「隐藏匹配文字」可同时显示 Emoji 与短码。普通 Emoji 规则也支持此开关。

在编辑器和阅读视图中，为关键词添加颜色、文字样式、Emoji、Lucide 图标、库内图片或 SVG。插件只改变显示，不改动笔记原文。

设置页支持自动保存、总开关、单规则开关、拖动排序、复制、筛选和删除撤销。左右列宽为 1:1，列表与编辑区独立滚动；可随时收起设置，直到再次点击规则进入编辑。面板小于 360 CSS px 时使用单列导航。断点按缩放后的实际面板宽度判断。

分组支持折叠、整组启用／禁用、组间拖动规则与整组排序；分组编辑区提供「上移／下移」按钮，首尾位置会禁用不可用的方向，也可在规则编辑区选择所属分组。点击分组名称配置共享样式；规则未设置的字段继承分组，明确关闭或清空的字段优先使用自身配置，↶ 可恢复继承。未分组规则优先，其后按分组及组内顺序匹配。

Lucide 支持关键字筛选、图标预览与名称，默认继承文字颜色。各装饰类型分别记忆内容；背景可选包含前缀。Advanced 的「把样式附加到整行」默认关闭，开启后作用于关键字所在的整个逻辑行；自动换行仍算同一行。正则的 `^`／`$` 按逻辑行匹配。自定义 CSS 可使用上方示例中的 `&` 定位当前规则。

图片支持按名称或路径搜索并显示缩略图，选择后保存完整库内路径。「网络图片」可直接粘贴 HTTP／HTTPS 图片链接，保留链接中的查询参数；SVG 可直接粘贴完整代码。三者均可设置显示尺寸；「隐藏匹配文字」默认关闭，开启后只保留图片，编辑时光标进入匹配范围会恢复原文显示。

「批量添加」支持每行一个关键词、从表格粘贴名称／关键词／图片路径三列，或粘贴 JSON。批量添加生成独立规则；匹配方式现在只有「关键词（每行一个）」和「正则表达式」。关键词填写一行或多行均可，逗号按文字匹配；旧规则的匹配含义会保留。导入内容会自动校验，可选择合并或替换，仅在需要清空时显示确认；导出会保留规则顺序和开关状态。

使用库内图片和 SVG 时完全本地运行；填写远程图片 URL 时会连接对应图片网站。复杂正则仍可能影响界面响应，请优先使用简单表达式或普通关键词。

## License

MIT. Based on the original work by NothingIsLost.
