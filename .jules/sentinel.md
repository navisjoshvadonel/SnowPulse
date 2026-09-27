## 2025-05-18 - Path Traversal in File-based AI Agent Tools
**Vulnerability:** `DatabaseTools.get_data_quality_report` accepted arbitrary string `file_path` inputs without canonicalization, allowing arbitrary system file reads (e.g. `/etc/passwd`).
**Learning:** Functions accepting local file paths from AI tools or external inputs can be exploited via directory traversal sequences (`../`) or direct absolute paths if not canonicalized with `os.path.realpath`.
**Prevention:** Always resolve paths using `os.path.realpath` and enforce prefix checks against white-listed base directories (`os.getcwd()`, `/tmp`) before opening files.

## 2026-03-27 - Path Traversal in StorageService Local Fallback
**Vulnerability:** `StorageService` local fallback operations (`get_file`, `upload_file`) joined `bucket_name` and `object_name` without canonicalization or path validation, allowing arbitrary file reads and writes via path traversal sequences (`../` or leading `/`).
**Learning:** Object storage abstractions with local file fallback must enforce path canonicalization and prefix checks against the local storage root directory. Direct path existence fallbacks without boundary checks can leak system files.
**Prevention:** Canonicalize paths with `os.path.realpath` and strip leading slashes before prefix validation against `self.local_dir`.
