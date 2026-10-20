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
