## 2026-07-15 - Modal & External Link ARIA Accessibility
**Learning:** Icon-only modal close buttons and external links lacking accessible text hamper screen reader accessibility and navigation. Adding explicit `aria-label` attributes to icon buttons and external documentation cards ensures screen readers announce the purpose and open-in-new-tab behavior clearly.
**Action:** Always include `aria-label="Close modal"` on icon-only close buttons and informative `aria-label="... (opens in a new tab)"` on external links when designing modal dialogs.
