# Palette's UX Journal

## 2025-05-18 - Modal Icon Button Accessibility
**Learning:** Icon-only buttons without visible text or labels (such as modal close controls 'X' and password visibility toggles) are completely opaque to screen reader users unless explicit `aria-label` or dynamic accessible names are attached.
**Action:** Always provide `aria-label` attributes for icon-only action elements across all modal dialog components.

## 2025-05-24 - Dynamic Accessible Labels in Management Lists
**Learning:** Repetitive icon buttons in list rows (such as delete or remove trash icons) must include target item context in their accessible name (e.g., `aria-label="Remove member {name}"` rather than a generic `aria-label="Remove"` or relying on `title`) so screen reader users navigating by controls know exactly which entity the action affects.
**Action:** Include contextual entity identifiers in `aria-label` for list item actions across administrative and settings modals.
