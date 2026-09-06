## 2024-05-15 - React Component Re-render Optimization
**Learning:** Found that helper functions (`getSourceIcon`, `getStatusPill`) inside React components without props or state dependencies are recreated on every render, and array methods (`filter`, `sort`) recalculate unnecessarily without `useMemo`.
**Action:** Always move static helper functions outside the component scope and wrap expensive derived state calculations in `useMemo` with correct dependencies to prevent unnecessary recalculations.
