## 2025-05-18 - Path Traversal in File-based AI Agent Tools
**Vulnerability:** `DatabaseTools.get_data_quality_report` accepted arbitrary string `file_path` inputs without canonicalization, allowing arbitrary system file reads (e.g. `/etc/passwd`).
**Learning:** Functions accepting local file paths from AI tools or external inputs can be exploited via directory traversal sequences (`../`) or direct absolute paths if not canonicalized with `os.path.realpath`.
**Prevention:** Always resolve paths using `os.path.realpath` and enforce prefix checks against white-listed base directories (`os.getcwd()`, `/tmp`) before opening files.
