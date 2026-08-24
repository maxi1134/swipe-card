## 6.0.0

- Support Home Assistant 2024.11 → 2026.8+
- Child cards are created as `hui-card` elements: per-card `visibility:`
  conditions, error cards and editor previews now work inside the swiper
- Visual editor: add, edit, reorder and delete child cards and set all
  options from the card dialog
- Jinja template support for `start_card` and `reset_after`, with live
  updates on state changes
- `start_card` accepts negative numbers (count from the end) and no longer
  races card loading (it used to always land on slide 1)
- Sections view support via `getGridOptions()`
- Swiper upgraded from v6 to v14 (fixes CVE-2026-27212 prototype pollution
  and shadow-DOM touch handling); Swiper v6 parameter names are translated
  automatically with a console warning
- Modernized build: Lit 3, Rollup 4, npm; added a browser test harness

## 4.0.0

- Drop support for older Home Assistant versions
- Report the correct card size
- Bug fixes

## 3.0.0

- Bundled version
- Updated swiper

## 2.0.1

- Make local possible with `path` option
- Some bug fixes

## 2.0.0

- Convert to LitElement

## 1.0.3

- Initial release that supports versioning
