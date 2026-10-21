# Validation

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

## 2026-10-21 Built-in Emoji controls

- Emoji 以特殊内置组显示，标注「内置」而非规则数量；不再展开内部规则。普通匹配下拉仅保留关键词和正则，内置组提供启停及隐藏文字两个开关。
- 根据已有短码组内容识别，无需重写配置；保留自定义名称、外观、禁用状态及原优先级。组与内部规则的旧开关状态合并为一个明确的启停操作；混合普通规则的旧分组不会隐藏成员。
- 普通规则不再把内置组作为所属分组选项，新建规则和规则拖动不会误入内置组。旧的未分组短码规则仍可用专用控件管理。
- 48 项 Node 测试、项目 lint、TypeScript、本地构建及差异检查通过；28 项隔离宿主检查覆盖专用 UI、状态同步和旧配置兼容，前后用户设置与 data.json 哈希不变。安装重载后逐字段确认全部现有设置一致。
- 官方 PR 预演为 0 errors、10 项既有 CSS 兼容性 warnings；本地缺少 GITHUB_STEP_SUMMARY 的 action 退出提示与前次相同。未执行版本发布。
