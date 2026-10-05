# Palette's UX Journal

## 2025-05-18 - Modal Icon Button Accessibility
**Learning:** Icon-only buttons without visible text or labels (such as modal close controls 'X' and password visibility toggles) are completely opaque to screen reader users unless explicit `aria-label` or dynamic accessible names are attached.
**Action:** Always provide `aria-label` attributes for icon-only action elements across all modal dialog components.

## 2025-05-19 - Navigation Header and Collapsed Sidebar Controls
**Learning:** Main navigation elements like top bar triggers (search, alerts, user menu) and collapsible sidebar buttons often rely solely on visual icons or state changes without specifying explicit `aria-expanded` and `aria-label` attributes, rendering app shell controls inaccessible.
**Action:** Always include `aria-label`, `aria-expanded`, and `aria-haspopup` attributes on main navigation bar controls and collapsible sidebar toggles.
