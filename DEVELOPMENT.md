# Development

The plugin decorates matches in CodeMirror 6 and Reading view. It never rewrites Markdown to implement a decoration. The development build requires Obsidian 1.8.7 or later; existing release version numbers and historical compatibility mappings are preserved until a release is requested.

## Local setup

1. Run `pnpm install`.
2. Copy `.env.example` to `.env` and set `VAULT_PATH` to an existing vault. Process environment variables take precedence; otherwise the copy script searches this repository and parent directories for `.env`.
3. Run `pnpm run test` and `pnpm run lint`.
4. Run `pnpm run build:local`, which type-checks, bundles into `dist/`, and copies the plugin assets to the configured vault. Existing `data.json` is preserved.
5. Allow Hot Reload to reload the plugin, or run `obsidian.com plugin:reload id=keyword-decorator`. Do not reload the entire application.
6. Open the plugin settings. `pnpm run build:local:set` combines the build/copy step with the settings opener when Hot Reload is active.

The settings opener retries briefly if a plugin reload and CLI request overlap. `NO.hotreload`, when present in an existing vault, is preserved.

Production builds (`pnpm run build`) additionally mirror `dist/main.js` to the repository root as `main.js`, next to the committed `manifest.json` and `styles.css`, matching the layout Obsidian's official release tooling expects. The root copy is gitignored and regenerated on every build.

## Code map

| Module | Responsibility |
| --- | --- |
| `src/main.ts` | Plugin lifecycle, debounced settings application, serialized persistence, per-document custom styles, Reading view integration |
| `src/highlighters/matching.ts` | Compile rule queries and resolve overlapping matches by configured priority |
| `src/highlighters/static.ts` | CodeMirror viewport decorations and image widgets; map stale ranges while recalculation is pending |
| `src/markers.ts` | Shared image resolution, SVG sanitation, marker construction and caches |
| `src/settings/settings.ts` | Data defaults, legacy configuration normalization and order repair |
| `src/settings/ui.ts` | Master toggle, rule navigation, reordering, duplication and undo |
| `src/settings/rule-editor.ts` | Editable rule fields and immediate preview |
| `src/settings/groups.ts`, `group-order.ts` | Effective inherited appearance, group enable gates and grouped priority mutations |
| `src/settings/appearance-editor.ts`, `icon-picker.ts` | Shared rule/group appearance fields and host icon search |
| `src/settings/image-picker.ts` | Vault image completion and thumbnail picker |
| `src/settings/bulk.ts` | Bulk input validation, optional appearance inheritance and safe appending |
| `src/settings/import.ts`, `export.ts` | Backward-compatible JSON import and ordered export |

## Data and persistence

Rules remain a map under `staticHighlighter.queries`, with priority in `queryOrder`. Missing order entries are repaired; unknown IDs and duplicates are removed from the order. Existing CSS and legacy fields survive normalization. Invalid regular-expression text remains editable and can be saved; importing an invalid rule reports an error before modifying current data.

New plain-text rules use `queryMode: "keywords"`, splitting only at line breaks. The UI exposes this mode and `regex`. Legacy `single` and comma-separated `multiple` queries remain readable without changing their meaning. Opening a legacy multiple rule displays its terms on separate lines; only editing its keywords converts it to the new mode.

The master `enabled` flag defaults to true. A rule defaults to enabled unless `enabled` is explicitly false. `hideText` defaults to false. Image dimensions default to 24 × 24 pixels and accept integers from 1 to 512.

An export can contain the legacy rule map or `{ enabled, staticHighlighter: { queries, queryOrder, groups, groupOrder } }`. Bulk import generates new rule and group IDs. Regular import can merge by ID or replace all rules after validation.

Group appearance supplies only undefined rule fields: `false`, `null` and empty strings are explicit overrides. Effective enable state combines the group and rule switches without changing either saved flag. Unset defaults are applied at render time to preserve inheritance. Marker `prefixValue` is the active value; `prefixValues` remembers each type for UI switching. Whole-line style is off by default and participates in inheritance. In the editor it uses a line decoration; Reading view styles logical-line text fragments while preserving inline elements. The first matching whole-line rule wins. Regexes use `gm`; visible editor ranges are expanded to complete logical lines before matching and then filtered back to visible intersections.

## Performance boundaries

- Matchers are compiled when settings change, rather than once per text node or keystroke.
- CodeMirror limits matching to visible ranges. Document changes map existing decoration ranges immediately and debounce recomputation.
- Settings text input updates its preview immediately. Runtime updates and disk writes are debounced; writes are serialized so an earlier write cannot finish after a newer one.
- Image resolution uses Obsidian's metadata cache and cached resource URLs. Vault image changes invalidate the cache.
- Overlap selection is deterministic: earlier rules in `queryOrder` win, including when a later rule begins earlier in the text.
- Regular-expression patterns are limited to 16,384 characters. Each rule produces at most 1,000 candidate matches per processed segment, and a segment has a 5,000-candidate cap. Multiple-keyword rules use at most 1,000 terms. These caps bound decoration volume, and do not impose a hard execution deadline on JavaScript regular expressions.

An intentionally pathological regular expression can still block the UI thread. Avoid nested or ambiguous unbounded repetitions. A future worker-based matcher would be needed to enforce a reliable timeout. Matching across disjoint viewport ranges or separate Markdown blocks is not guaranteed; hiding multi-line editor matches is deliberately avoided so line structure remains editable.

## Validation

`pnpm run test` bundles TypeScript tests into temporary CommonJS files and runs Node's test runner. The Obsidian mock supplies only host APIs needed to import data modules; it does not implement matching, normalization or persistence behavior.

For UI and runtime changes, additionally verify in Obsidian: automatic saving, rapid consecutive edits, duplicate/delete/undo, keyboard and pointer reordering, master and rule toggles, narrow-screen navigation, local image completion, SVG sanitation and dimensions, hidden text recovery, and Reading view cleanup after plugin reload. Run tests that replace settings in a separate test vault. Never run overlapping settings-mutation scripts in a personal vault: a timed-out CLI request can continue running inside Obsidian. Keep a durable configuration backup before any write-based host test, wait for the previous script to finish, and verify the final disk contents.

The local QA backup and temporary scripts live in ignored `.local-qa/`; they are not release assets. Actual verification results are recorded separately after checks finish.
