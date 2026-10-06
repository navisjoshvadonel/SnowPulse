# Palette's UX Journal

## 2025-05-18 - Modal Icon Button Accessibility
**Learning:** Icon-only buttons without visible text or labels (such as modal close controls 'X' and password visibility toggles) are completely opaque to screen reader users unless explicit `aria-label` or dynamic accessible names are attached.
**Action:** Always provide `aria-label` attributes for icon-only action elements across all modal dialog components.

## 2026-07-28 - Navigation Header Popup Trigger Accessibility
**Learning:** Top navigation menu triggers that toggle dropdown menus or alerts popovers (like bell notifications and user profile avatars) must expose both an explicit `aria-label` and dynamic popup state (`aria-expanded` and `aria-haspopup="true"`) to accurately inform assistive technology when menus are toggled.
**Action:** Always attach `aria-label`, `aria-expanded={isOpen}`, and `aria-haspopup="true"` to navbar icon and avatar dropdown trigger elements.
