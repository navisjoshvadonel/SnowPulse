## 2025-05-18 - Path Traversal in File-based AI Agent Tools
**Vulnerability:** `DatabaseTools.get_data_quality_report` accepted arbitrary string `file_path` inputs without canonicalization, allowing arbitrary system file reads (e.g. `/etc/passwd`).
**Learning:** Functions accepting local file paths from AI tools or external inputs can be exploited via directory traversal sequences (`../`) or direct absolute paths if not canonicalized with `os.path.realpath`.
**Prevention:** Always resolve paths using `os.path.realpath` and enforce prefix checks against white-listed base directories (`os.getcwd()`, `/tmp`) before opening files.

## 2025-05-19 - Path Traversal in StorageService Local Fallback
**Vulnerability:** `StorageService.get_file` and `upload_file` allowed directory traversal sequences (`../`) and unconstrained direct path reads (`if os.path.exists(object_name)`), allowing arbitrary system file reads and writes.
**Learning:** Local storage fallback mechanisms in object storage abstractions must canonicalize target paths and enforce root directory prefix containment checks rather than trusting input bucket or object names.
**Prevention:** Centralize path resolution in storage wrappers using `os.path.realpath` and enforce `target_path.startswith(base_dir + os.sep)` checks before performing disk IO operations.

## 2025-05-20 - Multi-Tenant Data Leakage via Fallback Query in `get_datasets`
**Vulnerability:** `get_datasets` returned all datasets in the database (`db.query(Dataset).all()`) when an authenticated user had no datasets associated with their account, leaking private datasets across tenant boundaries.
**Learning:** Fallback queries intended as helpful defaults or sample data in multi-tenant data access endpoints can inadvertently bypass tenant isolation checks when user-filtered results are empty.
**Prevention:** Ensure data retrieval endpoints strictly query filtering conditions (`owner_id == current_user.id`) and never fall back to unfiltered global database queries.

## 2025-05-21 - Sandbox Escape via Python Object Introspection in PolarsCodeExecutor
**Vulnerability:** `PolarsCodeExecutor` relied exclusively on restricted `__builtins__` dictionary to sandbox user-supplied code snippets, allowing attackers to access Python object introspection (`.__class__.__base__.__subclasses__()`) and escape the sandbox.
**Learning:** Restricting `__builtins__` in dynamic `exec()` blocks is insufficient to isolate Python code execution because dunder attributes allow traversing object hierarchies to reach unsafe builtins or loaded modules.
**Prevention:** Enforce static AST inspection (`ast.parse`) before executing user dynamic code to reject import statements (`ast.Import`/`ast.ImportFrom`) and dunder identifier or attribute access (`.startswith("__")`).

## 2025-05-22 - Multi-Tenant Isolation Bypass in `_get_dataset_for_user` Helper
**Vulnerability:** `_get_dataset_for_user` helper function attempted a fallback query without `owner_id` filtering if the dataset was not owned by `current_user`, leaking dataset access across tenant boundaries for ML and forecasting endpoints.
**Learning:** Helper functions used across endpoints for dataset retrieval must strictly maintain authorization checks (`owner_id == current_user.id`) rather than implementing global fallback queries.
**Prevention:** Never include fallback database queries that omit ownership/tenant criteria in multi-tenant resource lookups.
