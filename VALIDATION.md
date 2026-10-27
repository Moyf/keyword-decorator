# Validation

## 2026-10-28 PR #12 review fixes

- Reading-view section positions stay in source-character units until converted
  to occurrence counts separately for each once target's text. Missing, invalid
  or out-of-range section positions fall back to decorating all occurrences.
- Reading source scans exclude frontmatter and fenced code. CRLF/BOM, backtick,
  tilde and quoted fences are checked against the editor's line-class exclusion
  behavior; the editor retains its native syntax-tree exclusions.
- Each once rule scans independently so ordinary rules and earlier once rules
  cannot exhaust its document-target budget. A missing target keeps decorations
  visible in both rendering paths. Multiple blocks in one rendered section do
  not duplicate a located once target.
- Image-size schema strings enforce case-insensitive px/em units, integer px
  sizes from 1 to 512, and positive em sizes up to 32. The three size fields are
  compared with the runtime parser across normal forms and boundary values.
- Size inputs preserve incomplete drafts while focused, restore the effective
  value on blur after invalid input, and reset cleared width/height to 24.
- The existing Node test runner now executes 106 tests (94 existing plus 12 new).
  New DOM tests call the real reading-view entry point through asynchronous
  vault reads and caching, and the real appearance renderer through input/blur
  events. Only host APIs and synthetic note data are supplied by fixtures;
  `linkedom` is a pinned development dependency.
- The new reading integrations reproduce failures against original PR commit
  `f28adbb`; the fixed implementation passes. `pnpm test`, `pnpm lint`,
  `pnpm build` and `git diff --check` pass with Node 24.22.1 / pnpm 11.20.0.
  No native Obsidian/vault interaction or publication is part of these checks.

## 2026-10-27 Review decisions (Moy)

- Remove the legacy `editorViewField` fallback and its unused mock export:
  `minAppVersion: 1.13.0` guarantees `editorInfoField` is available.
- Pin the Obsidian development dependency to exactly `1.14.4` in both npm and
  pnpm lockfiles so independent dependency resolution cannot change the API
  version used for `@since` checks.
- Keep the explicit `no-unsafe-*` rule overrides scoped to `src/**`; do not
  expand their scope as part of this review. This is a recorded decision only,
  with no ESLint configuration change.

## 2026-10-22 Responsive workbench and group transfer

- 88 Node tests pass on the current main baseline, including multi-rule ordering, group-only export, repeated
  append imports with colliding IDs, preservation of existing settings and empty groups.
- Obsidian ESLint, Stylelint, TypeScript, production bundling and `git diff --check` pass.
- The official PR scan passes with 0 errors and the 10 existing underline/Settings
  `:has()` advisories. The PR is based on the current main branch; source-mode
  decoration remains opt-in, including after an append import.
- Browser checks use the installed Obsidian stylesheet and synthetic rules with an
  Obsidian API shim: 399 layout/selection checks across English/Chinese, light/dark
  themes, eight widths and two heights; 18 pointer/keyboard checks; and 20 group
  interaction checks. These include Ctrl/Shift selection, grouped dragging,
  cancellation, focused keyword entry, stable group clicks, double-click folding,
  export/import dialogs, failed-save retry, new groups and deletion undo.
- 19 isolated checks pass in Obsidian 1.15 with the Stillhaven theme, covering group
  navigation, transfer dialogs, append retry, five toolbar widths, new-group rendering
  and final asset installation. Both the live user's settings and the bytes of
  `data.json` remain unchanged by installation and QA. Synthetic settings were used
  for write-path checks; temporary DOM and modal instances were removed afterward.
- The final build is installed in the current local vault and its settings page is
  open. The plugin was reloaded without reloading the application. No mobile-device
  testing or version publication was performed.

## 2026-10-21–22 Decoration boundaries and source mode

- Synced with the merged rule workbench and Emoji shortcode changes. The existing groups, inheritance, ordering and shortcode preset remain supported.
- `npm test`: 81 tests pass, including Markdown context exclusions, overlapping protected ranges, whole-line segmentation, default-off source settings, import/export compatibility, ancestor/pseudo-element CSS selectors and eligible fallback matches after a protected match is rejected.
- Before the final review fixes, 15 checks passed in Obsidian 1.15 using an isolated plugin instance, native Markdown grammar, temporary CM6 editors and DOM. They cover source opt-in/out, link/code/math/tag/comment/embed exclusions, whole-line protection, Emoji hiding, foreign editors, reading view and the actual workbench toggle callback.
- The isolated check confirms that the installed plugin's runtime settings and `data.json` hash are unchanged, and creates no notes. It reports no captured runtime errors.
- Sixteen Chromium CSS checks pass on the final implementation. They cover pseudo-elements, functional selectors, quoted commas, conditional rules, dialog isolation, enabled-editor scope, theme/view ancestors, native nested children/media, declaration order and preventing selectors from escaping the note body.
- Independent review found and verified fixes for broken custom-CSS ancestor conditions and dropped native nested rules. The same reviewer re-reviewed the final patch, independently passed all 81 tests and the diff check, and found no remaining merge blockers. Protected candidates now leave eligible lower-priority matches available, and older `hmd-math` tokens remain excluded.
- Lint, TypeScript, production bundling, fixture-vault `build:local` and diff checks pass. The final official PR scan passes with 0 errors and the 10 existing underline/Settings `:has()` advisories.
- Source mode is undecorated by default; Live Preview and Reading view decorate only Markdown note bodies. Obsidian was no longer running for a final host rerun; the expanded native link-context probe did not produce a result and is not counted. Full mouse-driven interaction and mobile-device testing remain outside these checks.

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
- 48 项 Node 测试、项目 lint、TypeScript、本地构建及差异检查通过；33 项隔离宿主检查覆盖专用 UI、状态同步、未分组及混合组的双向开关和旧配置兼容，前后用户设置与 data.json 哈希不变。安装重载后逐字段确认全部现有设置一致。
- 官方 PR 预演为 0 errors、10 项既有 CSS 兼容性 warnings；本地缺少 GITHUB_STEP_SUMMARY 的 action 退出提示与前次相同。未执行版本发布。
