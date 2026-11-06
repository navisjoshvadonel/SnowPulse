"""
SnowPulse AI - Native Conversational AI Data Analyst Agent.
Translates user natural language queries into safe, vectorized Polars expressions,
executes them in the AST sandbox, and returns formatted data tables and analytical narratives.
Works both with Gemini API and in 100% offline heuristic mode!
"""

import os
import re
from typing import Any

import polars as pl

from ..ai.gemini_service import GeminiService
from ..analytics.code_executor import PolarsCodeExecutor


class NativeDataChatAgent:
    def __init__(self, df: pl.DataFrame, dataset_name: str = "dataset"):
        self.df = df
        self.dataset_name = dataset_name
        self.columns = df.columns
        self.schema = {col: str(dtype) for col, dtype in zip(df.columns, df.dtypes, strict=False)}
        self.numeric_cols = [c for c, dt in zip(df.columns, df.dtypes, strict=False) if dt.is_numeric()]
        self.categorical_cols = [c for c, dt in zip(df.columns, df.dtypes, strict=False) if not dt.is_numeric()]

        self.api_key = os.getenv("GEMINI_API_KEY")
        self.has_llm = bool(self.api_key and not self.api_key.startswith("mock-"))
        self.gemini = GeminiService() if self.has_llm else None

    def query(self, question: str) -> dict[str, Any]:
        """
        Executes a natural language data query and returns the tabular result, generated code, and narrative.
        """
        q = question.strip()
        if not q:
            return {"success": False, "error": "Query cannot be empty."}

        # 1. Generate Polars code snippet
        code = self._generate_polars_code(q)

        # 2. Execute safely via PolarsCodeExecutor AST sandbox & safe globals
        try:
            PolarsCodeExecutor._validate_ast(code)
        except Exception as e:
            return {
                "success": False,
                "error": f"Security / Validation error: {e}",
                "code": code,
                "narrative": "Query violated sandbox security boundaries.",
            }

        local_vars = {"df": self.df, "pl": pl, "polars": pl, "result": None}
        try:
            exec(code, PolarsCodeExecutor.SAFE_GLOBALS, local_vars)
            res_data = local_vars.get("result")
        except Exception as e:
            return {
                "success": False,
                "error": f"Query execution failed: {e}",
                "code": code,
                "narrative": "Could not execute the generated data query expression.",
            }

        if isinstance(res_data, pl.DataFrame):
            res_df = res_data
        elif isinstance(res_data, pl.LazyFrame):
            res_df = res_data.collect()
        elif isinstance(res_data, pl.Series):
            res_df = res_data.to_frame()
        elif isinstance(res_data, (int, float, str, bool)):
            res_df = pl.DataFrame({"result": [res_data]})
        elif isinstance(res_data, list):
            res_df = pl.DataFrame(res_data)
        elif res_data is None:
            res_df = pl.DataFrame({"status": ["Executed with no output"]})
        else:
            res_df = pl.DataFrame({"output": [str(res_data)]})

        # 3. Formulate analytical narrative
        narrative = self._generate_narrative(q, res_df, code)

        return {
            "success": True,
            "code": code,
            "result_df": res_df,
            "row_count": res_df.height,
            "col_count": res_df.width,
            "narrative": narrative,
        }

    def _generate_polars_code(self, q: str) -> str:
        """
        Generates Polars query expression using Gemini if available, or offline semantic rules.
        """
        if self.has_llm and self.gemini:
            try:
                system_prompt = f"""You are a master data analyst using Polars in Python.
The DataFrame is provided in variable `df` with columns: {self.columns} and schema: {self.schema}.
Return ONLY executable Python code setting variable `result = ...` using Polars expressions.
Do NOT include markdown fences, imports, or print statements. Output one clean code line or block.
"""
                resp = self.gemini.model.generate_content(f"{system_prompt}\nUser question: {q}")
                raw_code = resp.text.strip().replace("```python", "").replace("```", "").strip()
                if "result =" in raw_code or "result=" in raw_code:
                    return raw_code
                return f"result = {raw_code}"
            except Exception:
                pass

        # Offline Semantic Translation
        return self._heuristic_polars_code(q)

    def _heuristic_polars_code(self, q: str) -> str:
        q_low = q.lower()

        # Head / Sample / Preview
        if re.search(r"\b(head|preview|first|sample|top rows)\b", q_low):
            n = 5
            match = re.search(r"\b(\d+)\b", q_low)
            if match:
                n = int(match.group(1))
            return f"result = df.head({n})"

        # Tail / Last rows
        if re.search(r"\b(tail|last rows)\b", q_low):
            n = 5
            match = re.search(r"\b(\d+)\b", q_low)
            if match:
                n = int(match.group(1))
            return f"result = df.tail({n})"

        # Shape / Row count / Summary
        if re.search(r"\b(shape|count rows|how many rows|size)\b", q_low):
            return "result = pl.DataFrame({'row_count': [df.height], 'column_count': [df.width]})"

        # Group by and aggregate: e.g. "average revenue by region", "total sales by product"
        agg_func = None
        if "average" in q_low or "mean" in q_low or "avg" in q_low:
            agg_func = "mean"
        elif "total" in q_low or "sum" in q_low:
            agg_func = "sum"
        elif "max" in q_low or "highest" in q_low:
            agg_func = "max"
        elif "min" in q_low or "lowest" in q_low:
            agg_func = "min"
        elif "count" in q_low or "number of" in q_low:
            agg_func = "count"

        # Check for group by column
        group_col = None
        match_by = re.search(r"\b(?:by|per|across|for each)\s+([a-zA-Z0-9_]+)", q_low)
        if match_by:
            candidate = match_by.group(1).strip()
            for col in self.columns:
                if col.lower() == candidate or candidate in col.lower():
                    group_col = col
                    break

        # Check for metric column
        metric_col = None
        for col in self.numeric_cols:
            if col.lower() in q_low:
                metric_col = col
                break
        if not metric_col and self.numeric_cols:
            metric_col = self.numeric_cols[0]

        if group_col and agg_func and metric_col:
            return f"result = df.group_by('{group_col}').agg(pl.col('{metric_col}').{agg_func}().alias('{agg_func}_{metric_col}')).sort('{agg_func}_{metric_col}', descending=True).head(10)"

        if group_col:
            # Value counts of categorical
            return f"result = df['{group_col}'].value_counts().sort('count', descending=True).head(10)"

        if agg_func and metric_col:
            return f"result = pl.DataFrame({{'{agg_func}_{metric_col}': [float(df['{metric_col}'].{agg_func}())]}})"

        # Sort / Top N
        if "top" in q_low or "highest" in q_low:
            n = 5
            match = re.search(r"\b(\d+)\b", q_low)
            if match:
                n = int(match.group(1))
            if metric_col:
                return f"result = df.sort('{metric_col}', descending=True).head({n})"

        # Describe / summary
        if "describe" in q_low or "summary" in q_low or "stats" in q_low:
            return "result = df.describe()"

        # Correlation
        if "correlation" in q_low or "corr" in q_low:
            cols = self.numeric_cols[:5]
            return f"result = df.select({cols}).corr()"

        # Default fallback: display head
        return "result = df.head(10)"

    def _generate_narrative(self, query: str, res_df: pl.DataFrame, code: str) -> str:
        """
        Creates an analytical explanation for the answer.
        """
        if res_df.height == 1 and res_df.width == 1:
            val = res_df.to_numpy()[0, 0]
            col_name = res_df.columns[0]
            return f"The computed {col_name} is **{val:,.2f}**." if isinstance(val, (int, float)) else f"Result: **{val}**."

        if res_df.height <= 10 and res_df.width <= 4:
            first_col = res_df.columns[0]
            top_val = res_df[first_col][0] if res_df.height > 0 else "N/A"
            return f"Retrieved {res_df.height} records. Top ranked entry is **{top_val}**."

        return f"Successfully processed query across {self.df.height:,} rows. Returned {res_df.height} result rows across {res_df.width} metrics."
