## 2025-05-18 - Python Exec Sandbox Escape Prevention
**Vulnerability:** Incomplete Python `exec()` sandboxing in `PolarsCodeExecutor` and `DatabaseTools.run_python_forecast` allowed arbitrary code execution via dunder attributes (`__subclasses__`, `__globals__`, `__bases__`, `__mro__`) and unsafe identifiers/imports.
**Learning:** Restricting `__builtins__` in `exec()` is insufficient because attackers can traverse Python object graph hierarchies via class dunder attributes to retrieve un-sandboxed modules (`os`, `sys`, `subprocess`).
**Prevention:** Perform AST parsing and traversal before invoking `exec()` to reject import statements, dangerous identifiers (`eval`, `exec`, `open`), and dunder attributes (`__subclasses__`, `__globals__`, `__bases__`, `__mro__`).
