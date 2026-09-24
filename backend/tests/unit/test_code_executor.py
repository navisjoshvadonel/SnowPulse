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
        with pytest.raises(PolarsCodeExecutionError) as exc_info:
            PolarsCodeExecutor.execute_cleaning_code(df, script)
        assert "Import statements are forbidden" in str(exc_info.value)

    def test_sandbox_blocks_dunder_traversal(self):
        df = pl.DataFrame({"a": [1, 2, 3]})
        script = """
for c in ().__class__.__base__.__subclasses__():
    if 'catch_warnings' in c.__name__:
        os = c()._module.sys.modules['os']
"""
        with pytest.raises(PolarsCodeExecutionError) as exc_info:
            PolarsCodeExecutor.execute_cleaning_code(df, script)
        assert "forbidden" in str(exc_info.value).lower()

    def test_sandbox_blocks_restricted_calls(self):
        df = pl.DataFrame({"a": [1, 2, 3]})
        script = "eval('1 + 1')"
        with pytest.raises(PolarsCodeExecutionError) as exc_info:
            PolarsCodeExecutor.execute_cleaning_code(df, script)
        assert "Call to restricted function" in str(exc_info.value)
