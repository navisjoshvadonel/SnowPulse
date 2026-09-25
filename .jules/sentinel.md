## 2025-05-18 - Path Traversal in File-based AI Agent Tools
**Vulnerability:** `DatabaseTools.get_data_quality_report` accepted arbitrary string `file_path` inputs without canonicalization, allowing arbitrary system file reads (e.g. `/etc/passwd`).
**Learning:** Functions accepting local file paths from AI tools or external inputs can be exploited via directory traversal sequences (`../`) or direct absolute paths if not canonicalized with `os.path.realpath`.
**Prevention:** Always resolve paths using `os.path.realpath` and enforce prefix checks against white-listed base directories (`os.getcwd()`, `/tmp`) before opening files.

## 2025-05-18 - Multi-tenant Dataset Isolation Fallback Leak
**Vulnerability:** `GET /api/datasets` fell back to returning `db.query(Dataset).all()` when a user had no datasets, exposing all private tenant datasets to users without uploaded data.
**Learning:** Empty collection evaluation (`if user_datasets:`) used as a fallback trigger can cause accidental cross-tenant data leakage in multi-tenant resource listing APIs.
**Prevention:** Never use fallback queries that bypass tenant filters (`owner_id == current_user.id`) in multi-tenant data access layers.
