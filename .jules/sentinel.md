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

## 2025-05-21 - Python Sandbox RCE via Dunder Subclasses Introspection
**Vulnerability:** Restricted `__builtins__` dictionaries in `PolarsCodeExecutor` and `DatabaseTools.run_python_forecast` were bypassable using dunder attribute introspection (e.g., `Exception.__subclasses__()`) to reach loaded module globals and execute arbitrary shell commands.
**Learning:** Restricting `__builtins__` in Python `exec()` is insufficient for sandboxing because any available object/class exposes dunder attributes (`__subclasses__`, `__globals__`, `__bases__`) leading to RCE.
**Prevention:** Perform static AST inspection (`ast.parse`) prior to execution to block all `ast.Import`/`ast.ImportFrom` nodes as well as dunder identifier and attribute access (`__`).
