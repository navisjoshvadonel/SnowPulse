# Palette's UX Journal

## 2025-05-18 - Modal Icon Button Accessibility
**Learning:** Icon-only buttons without visible text or labels (such as modal close controls 'X' and password visibility toggles) are completely opaque to screen reader users unless explicit `aria-label` or dynamic accessible names are attached.
**Action:** Always provide `aria-label` attributes for icon-only action elements across all modal dialog components.

## 2026-10-07 - Navigation Controls Keyboard Focus & ARIA Semantics
**Learning:** Top navigation controls and header trigger buttons are heavily used by screen reader and keyboard users; missing `aria-expanded`, `aria-haspopup`, or `focus-visible` ring styles makes header navigation difficult and non-standard.
**Action:** Always include explicit ARIA menu roles and `focus-visible:ring-2` styles on top navbar trigger controls and popover menus.
