## 2026-09-23 - Dataset Endpoint Fallback Multi-Tenant Leak
**Vulnerability:** The `/api/datasets` GET endpoint returned `db.query(Dataset).all()` if `db.query(Dataset).filter(Dataset.owner_id == current_user.id).all()` returned empty. This leaked all system datasets across tenants to any newly registered user or user without datasets.
**Learning:** Defensive fallback queries in data fetching endpoints can break logical tenant isolation when user data is empty.
**Prevention:** Always filter dataset and resource queries strictly by tenant/owner identifier (`owner_id == current_user.id`) without fallback behavior.
