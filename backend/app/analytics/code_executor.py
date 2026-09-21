import ast
from typing import Any

import polars as pl

from ..logging_config import logger


class PolarsCodeExecutionError(Exception):
    pass


class PolarsCodeExecutor:
    """
    Executes Python transformation code on Polars LazyFrames.
    Forces execution on df.lazy() so Polars query optimizer optimizes
    predicate pushdowns, projection pushdowns, and expression trees before .collect() is called.
    """

    SAFE_GLOBALS = {
        "__builtins__": {
            "abs": abs,
            "len": len,
            "min": min,
            "max": max,
            "str": str,
            "int": int,
            "float": float,
            "bool": bool,
            "list": list,
            "dict": dict,
            "set": set,
            "range": range,
            "enumerate": enumerate,
            "zip": zip,
            "print": print,
        },
        "pl": pl,
        "polars": pl,
    }

    @classmethod
    def _validate_ast(cls, code_snippet: str) -> None:
        """
        Parses code_snippet AST and verifies there are no unsafe imports,
        dunder attribute access (e.g. __class__, __subclasses__), or prohibited call names.
        """
        try:
            tree = ast.parse(code_snippet)
        except Exception as e:
            raise PolarsCodeExecutionError(f"Syntax error in Python code snippet: {str(e)}")

        forbidden_calls = {"exec", "eval", "open", "__import__", "compile", "globals", "locals"}

        for node in ast.walk(tree):
            if isinstance(node, ast.Import | ast.ImportFrom):
                raise PolarsCodeExecutionError("Security alert: Import statements are forbidden in user code.")
            if isinstance(node, ast.Attribute) and node.attr.startswith("__"):
                raise PolarsCodeExecutionError(f"Security alert: Access to internal attribute '{node.attr}' is forbidden.")
            if isinstance(node, ast.Name) and node.id.startswith("__"):
                raise PolarsCodeExecutionError(f"Security alert: Use of internal identifier '{node.id}' is forbidden.")
            if isinstance(node, ast.Call):
                if isinstance(node.func, ast.Name) and node.func.id in forbidden_calls:
                    raise PolarsCodeExecutionError(f"Security alert: Call to restricted function '{node.func.id}' is forbidden.")

    @classmethod
    def execute_cleaning_code(
        cls,
        df: pl.DataFrame,
        code_snippet: str
    ) -> tuple[pl.DataFrame, dict[str, Any]]:
        """
        Converts df to a LazyFrame (ldf), validates AST safety, executes code_snippet in a
        sandboxed environment, and calls .collect() to optimize and materialize the final DataFrame.
        """
        cls._validate_ast(code_snippet)

        if not isinstance(df, pl.DataFrame):
            if isinstance(df, pl.LazyFrame):
                ldf = df
            else:
                raise PolarsCodeExecutionError("Input dataset must be a Polars DataFrame or LazyFrame.")
        else:
            ldf = df.lazy()

        local_vars = {
            "df": ldf,
            "ldf": ldf,
            "result": None,
        }

        try:
            # Execute cleaning script in safe namespace
            exec(code_snippet, cls.SAFE_GLOBALS, local_vars)
        except Exception as e:
            logger.error("polars_executor.execution_failed", error=str(e), code=code_snippet)
            raise PolarsCodeExecutionError(f"Failed to execute Polars cleaning script: {str(e)}")

        # Retrieve resulting LazyFrame or DataFrame using explicit is not None checks (avoiding boolean context)
        res = None
        for key in ["result", "ldf", "df"]:
            val = local_vars.get(key)
            if val is not None:
                res = val
                break

        if isinstance(res, pl.LazyFrame):
            # Polars automatically optimizes execution query plan here!
            final_df = res.collect()
        elif isinstance(res, pl.DataFrame):
            final_df = res
        else:
            raise PolarsCodeExecutionError("Execution script did not return a valid Polars LazyFrame or DataFrame.")

        report = {
            "status": "success",
            "original_rows": df.height if isinstance(df, pl.DataFrame) else None,
            "final_rows": final_df.height,
            "original_cols": len(df.columns) if isinstance(df, pl.DataFrame) else None,
            "final_cols": len(final_df.columns),
            "lazy_execution": True,
        }

        return final_df, report
