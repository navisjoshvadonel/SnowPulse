## 2025-05-18 - Path Traversal in File-based AI Agent Tools
**Vulnerability:** `DatabaseTools.get_data_quality_report` accepted arbitrary string `file_path` inputs without canonicalization, allowing arbitrary system file reads (e.g. `/etc/passwd`).
**Learning:** Functions accepting local file paths from AI tools or external inputs can be exploited via directory traversal sequences (`../`) or direct absolute paths if not canonicalized with `os.path.realpath`.
**Prevention:** Always resolve paths using `os.path.realpath` and enforce prefix checks against white-listed base directories (`os.getcwd()`, `/tmp`) before opening files.

## 2025-05-19 - Path Traversal in StorageService Local Fallback
**Vulnerability:** `StorageService.get_file` and `upload_file` allowed directory traversal sequences (`../`) and unconstrained direct path reads (`if os.path.exists(object_name)`), allowing arbitrary system file reads and writes.
**Learning:** Local storage fallback mechanisms in object storage abstractions must canonicalize target paths and enforce root directory prefix containment checks rather than trusting input bucket or object names.
**Prevention:** Centralize path resolution in storage wrappers using `os.path.realpath` and enforce `target_path.startswith(base_dir + os.sep)` checks before performing disk IO operations.
