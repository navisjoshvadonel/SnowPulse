import os

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("JWT_SECRET_KEY", "testsecretkeytestsecretkeytestsecretkey")
os.environ.setdefault("JWT_REFRESH_SECRET_KEY", "testrefreshsecretkeytestrefreshsecretkey")
os.environ.setdefault("ENV", "testing")

import polars as pl
import pytest

from backend.app.analytics.code_executor import PolarsCodeExecutionError, PolarsCodeExecutor


class TestPolarsCodeExecutor:
    def test_lazyframe_execution_and_collect(self):
        df = pl.DataFrame({
            "category": ["A", "B", "A", "C"],
            "revenue": [100, 200, 150, 300]
        })

        script = """
ldf = ldf.filter(pl.col("revenue") > 120)
ldf = ldf.with_columns((pl.col("revenue") * 1.1).alias("adjusted_revenue"))
result = ldf
"""

        final_df, report = PolarsCodeExecutor.execute_cleaning_code(df, script)

        assert isinstance(final_df, pl.DataFrame)
        assert final_df.height == 3
        assert "adjusted_revenue" in final_df.columns
        assert report["lazy_execution"] is True

    def test_sandbox_blocks_imports(self):
        df = pl.DataFrame({"a": [1, 2, 3]})
        script = """
import os
os.system('echo hacked')
"""
        with pytest.raises(PolarsCodeExecutionError):
            PolarsCodeExecutor.execute_cleaning_code(df, script)

    def test_sandbox_blocks_subclasses_dunder_escape(self):
        df = pl.DataFrame({"a": [1, 2, 3]})
        script = """
res = (1).__class__.__base__.__subclasses__()
"""
        with pytest.raises(PolarsCodeExecutionError) as exc_info:
            PolarsCodeExecutor.execute_cleaning_code(df, script)
        assert "unsafe attribute" in str(exc_info.value).lower() or "forbidden" in str(exc_info.value).lower()
