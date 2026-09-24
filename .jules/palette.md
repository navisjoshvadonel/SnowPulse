# Palette's UX Journal

## 2025-05-18 - Modal Icon Button Accessibility
**Learning:** Icon-only buttons without visible text or labels (such as modal close controls 'X' and password visibility toggles) are completely opaque to screen reader users unless explicit `aria-label` or dynamic accessible names are attached.
**Action:** Always provide `aria-label` attributes for icon-only action elements across all modal dialog components.
