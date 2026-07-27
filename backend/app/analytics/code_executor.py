from typing import Any, Tuple
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
    def execute_cleaning_code(
        cls,
        df: pl.DataFrame,
        code_snippet: str
    ) -> Tuple[pl.DataFrame, dict[str, Any]]:
        """
        Converts df to a LazyFrame (ldf), executes code_snippet in a sandboxed environment,
        and calls .collect() to optimize and materialize the final DataFrame.
        """
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
