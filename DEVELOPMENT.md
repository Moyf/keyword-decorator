# Keyword Decorator - Development Requirements

## 1. Project Scope

- Baseline: created from `highlight-decorator` implementation pattern.
- Plugin ID: `keyword-decorator`.
- Initial target: Obsidian Editor (CodeMirror 6) only.
- Reading view support is out of scope for phase 1.

## 2. Core Requirements

### 2.1 Keyword Rules

- Support multiple keyword rules.
- Each rule supports plain text or RegExp matching.
- Each rule can configure:
  - text color
  - background color
  - font weight
  - italic
  - underline
  - custom CSS class
- Rule-level enable/disable switch.

### 2.2 Rule Groups

- Support grouping rules (e.g. `General`, `Writing`, `Review`).
- Group-level enable/disable switch.
- Group-level defaults can be overridden by rule-level settings.
- Stable priority when multiple rules match the same range.

### 2.3 Decorations

- Apply decorations through CodeMirror 6 `ViewPlugin` + `Decoration`.
- Render style changes without mutating note content.
- Optional prefix marker before match:
  - Emoji
  - icon name mapping
  - inline SVG (sanitized)
  - vault image path (with fallback)

### 2.4 Settings UI

- Provide full settings tab for:
  - create/edit/delete groups
  - create/edit/delete rules
  - reorder rules
  - toggle group/rule enabled state
- Live preview for rule updates.
- Import/export all rules as JSON.

## 3. Performance and Safety

- Do not full-scan the whole document on every keystroke.
- Prefer viewport-based updates and incremental recalculation.
- Add guardrails for invalid RegExp.
- Sanitize SVG input and safely handle broken image paths.
- Ensure plugin does not break on mobile; degrade gracefully if needed.

## 4. Milestones

- M1: Data model + persistence + migration.
- M2: Matching engine + conflict resolution.
- M3: Basic style decorations + group toggles.
- M4: Prefix markers (emoji/icon/svg/image).
- M5: Settings UX + JSON import/export.
- M6: Performance validation + mobile compatibility checks.

## 5. Acceptance Criteria

- 50 rules on a 500KB markdown file remains responsive.
- Conflict priority is deterministic and testable.
- Group and rule toggles update decorations correctly.
- JSON export/import round-trip keeps rule data consistent.
- Invalid rule data does not crash editor rendering.
- Prefix marker sources render correctly or fall back safely.

## 6. Notes

- Keep architecture compatible with future reading-view extension.
- Keep style generation centralized to avoid duplicated CSS logic.
