# Validation

## 2026-10-21 Decoration boundaries and source mode

- Synced with the merged rule workbench and Emoji shortcode changes. The existing groups, inheritance, ordering and shortcode preset remain supported.
- `npm test`: 72 tests pass, including Markdown context exclusions, overlapping protected ranges, whole-line segmentation, default-off source settings and import/export compatibility.
- 15 checks pass in Obsidian 1.15 using an isolated plugin instance, native Markdown grammar, temporary CM6 editors and DOM. They cover source opt-in/out, link/code/math/tag/comment/embed exclusions, whole-line protection, Emoji hiding, foreign editors, reading view and the actual workbench toggle callback.
- The isolated check confirms that the installed plugin's runtime settings and `data.json` hash are unchanged, and creates no notes. It reports no captured runtime errors.
- Seven Chromium CSS checks cover pseudo-elements, functional selectors, quoted commas, conditional rules, dialog isolation and enabled-editor scope.
- Lint, TypeScript, production bundling, fixture-vault `build:local` and diff checks pass. The final official PR scan reports 0 errors and the 10 existing underline/Settings `:has()` advisories; the local job-summary footer could not access its output file.
- Source mode is undecorated by default; Live Preview and Reading view decorate only Markdown note bodies. Full mouse-driven interaction and mobile-device testing remain outside these checks.

## PR #1 review - 2026-10-21

The review covers the rule workbench, group appearance inheritance and ordering,
bulk rules, image markers, logical-line matching and settings compatibility.
Fixtures use synthetic rules and contain no personal vault data.

### Automated checks

- `npm test`: 37 tests pass, including legacy settings, grouped rule order,
  explicit appearance overrides, import/export, bulk addition, overlapping
  matches, line anchors and viewport boundaries.
- `npm run lint`: Obsidian ESLint rules and Stylelint pass.
- `npm run build`: TypeScript checking and production bundling pass.
- `git diff --check`: passes.
- `npm run build:local`: build and asset copying pass against an isolated fixture vault.
- Official `obsidian-workflows` PR scan: 0 errors, 10 warnings, 0 recommendations.
  The warnings concern partial browser support for underline decoration (6) and
  `:has()` selectors scoped to Settings containers (4). They are reviewed
  compatibility/performance advisories, not failed functional checks.
  The final repeat could not refresh the community registry; source, build and
  scanner checks still completed. This review does not certify store submission.

### Browser regression checks

28 checks pass in a headless Chromium browser using real CodeMirror state,
views and decorations, with an Obsidian UI/API shim. They cover:

- Group Move up / Move down buttons, repeated moves, first/last/single-group
  boundaries, complete rule-block ordering and preservation of rule settings.
- Toolbar boundary states after keyboard reordering.
- Bulk appearance templates including inherited group appearance.
- Hidden source becoming editable on cursor entry or selection, with and
  without whole-line styling; invalid or missing markers retain visible text.
- Image failures restoring preview text, without late errors reviving stale text.
- Reading-view logical-line styles preserving inline markup and adjacent lines.

These checks validate browser rendering and event callbacks. They do not replace
Obsidian host or physical-device testing. Obsidian was not running during this
review, so the new buttons were not tested in the native Settings window.

### Compatibility and limits

- The manifest requires Obsidian 1.8.7 or later. The plugin version is unchanged;
  this merge does not publish a release.
- Notes remain unchanged: decorations affect presentation only. Earlier rules
  take priority when matches overlap; moving a group changes that priority.
- HTTP/HTTPS image markers request the configured image host. Vault images and
  pasted SVG do not require those network requests.
- Complex JavaScript regular expressions can still block the UI thread. Pattern
  and match-count limits do not provide an execution timeout.
- No mobile-device testing was performed during this review.

## 2026-10-21 Emoji shortcodes

- 新增默认 Emoji shortcodes 分组，1,914 个 Unicode 别名共用一条匹配规则，字典数据为 42,442 UTF-8 字节；包含 gemoji 的固定来源及 MIT 许可。
- 45 项 Node 测试通过；新增覆盖全部别名、未知短码、相邻短码、原有优先级、预设安装幂等、ID 冲突、删除保留、导入导出及批量添加。独立审查复现的批量入口模式遗漏及空 query 问题均已修复并回归。
- Obsidian 1.15 中使用隔离插件实例、临时 CM6 编辑器及 DOM 完成 32 项检查：编辑和阅读显示、隐藏开关、光标及选择恢复、代码区域、整行样式、分组禁用、设置控件及匹配模式切换。测试前后真实运行时配置和 data.json 哈希不变；未创建或修改笔记。隔离检查不代表完整实体鼠标或移动设备验收。
- 安装前后逐字段核对原有 16 条规则及 6 个分组，内容与顺序均保留，仅追加一个预设分组和规则。用户可关闭预设，重载不会重置修改或删除。
- 项目 lint、TypeScript、本地构建及差异检查通过。最终官方 PR 预演为 0 errors、10 项既有 CSS 兼容性 warnings；缺少本地 GITHUB_STEP_SUMMARY 仍是 action 退出时的环境提示。
- 生产 main.js 约 132.4 KiB，相比 PR #1 基线增加约 38.8 KiB；无需运行时网络请求或图片资源。版本号保持原状。
