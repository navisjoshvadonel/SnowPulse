"""
SnowPulse AI - Native Offline Desktop Application.
Complete real-world data analysis pipeline:
Ingestion/Upload ➔ Quality Audit ➔ Preprocessing & Cleaning Studio ➔ Reactive Intelligence Dashboard ➔ Conversational AI ➔ AutoML.
100% offline, zero-server, direct Python-to-GUI bridge with embedded ECharts.
"""

import base64
import json
from pathlib import Path
from typing import Any

import numpy as np
import polars as pl
try:
    import webview
except ImportError:
    webview = None

from .analyzer import NativeDataAnalyzer
from .automl import NativeAutoMLEngine
from .chat import NativeDataChatAgent
from .cleaner import NativeDataPreprocessor
from .loader import load_dataset
from .report import generate_html_report

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
STATIC_DIR = Path(__file__).resolve().parent / "static"
SAMPLE_CSV = PROJECT_ROOT / "backend" / "local_storage" / "datasets" / "saas_customer_churn_analytics.csv"


class DesktopAppAPI:
    """Python API exposed to the JavaScript frontend via pywebview."""

    def __init__(self, initial_dataset_path: str | None = None):
        self.window: Any = None
        self.dataset_path: str | None = initial_dataset_path
        self.raw_df: pl.DataFrame | None = None
        self.clean_df: pl.DataFrame | None = None
        self.filtered_df: pl.DataFrame | None = None

        self.analyzer: NativeDataAnalyzer | None = None
        self.chat_agent: NativeDataChatAgent | None = None
        self.audit_report: dict[str, Any] | None = None
        self.cleaning_report: dict[str, Any] | None = None

        if initial_dataset_path and Path(initial_dataset_path).exists():
            try:
                self._load_raw_file(initial_dataset_path)
            except Exception:
                pass

    def set_window(self, window: Any):
        self.window = window

    def load_dataset(self, filepath: str) -> dict[str, Any]:
        """Loads a dataset from file path into the app."""
        return self._load_raw_file(filepath)

    def _load_raw_file(self, filepath: str) -> dict[str, Any]:
        path = Path(filepath).resolve()
        if not path.exists():
            raise FileNotFoundError(f"File not found: {filepath}")

        self.raw_df = load_dataset(str(path))
        self.dataset_path = str(path)
        dataset_name = path.name

        # Run quality audit on raw data
        self.audit_report = NativeDataPreprocessor.audit(self.raw_df)

        # Raw sample rows (first 10)
        preview_rows = []
        if self.raw_df.height > 0:
            for row in self.raw_df.head(10).iter_rows():
                preview_rows.append([str(v) if v is not None else "" for v in row])

        raw_columns = []
        for col in self.raw_df.columns:
            dt = str(self.raw_df[col].dtype)
            nulls = self.raw_df[col].null_count()
            raw_columns.append({
                "name": col,
                "dtype": dt,
                "null_count": nulls,
                "null_pct": round((nulls / max(self.raw_df.height, 1)) * 100.0, 1),
            })

        return {
            "success": True,
            "filename": dataset_name,
            "filepath": str(path),
            "rows": self.raw_df.height,
            "columns_count": self.raw_df.width,
            "columns": raw_columns,
            "summary": {"rows": self.raw_df.height, "columns": self.raw_df.width},
            "audit": self.audit_report,
            "preview_columns": self.raw_df.columns,
            "preview_rows": preview_rows,
        }

    def select_file_dialog(self) -> dict[str, Any]:
        """Triggers native Ubuntu file chooser dialog."""
        if not self.window:
            return {"success": False, "error": "Window not ready"}

        file_types = ("Data Files (*.csv;*.parquet;*.tsv;*.json;*.xlsx;*.db)", "All files (*.*)")
        selected = self.window.create_file_dialog(
            webview.OPEN_DIALOG,
            allow_multiple=False,
            file_types=file_types,
        )

        if selected and len(selected) > 0:
            try:
                return self._load_raw_file(selected[0])
            except Exception as e:
                return {"success": False, "error": str(e)}
        return {"cancelled": True}

    def load_sample_dataset(self) -> dict[str, Any]:
        """Loads built-in sample SaaS dataset into the audit studio."""
        if SAMPLE_CSV.exists():
            return self._load_raw_file(str(SAMPLE_CSV))
        return {"success": False, "error": "Sample dataset not found."}

    def upload_file_content(self, filename: str, content_base64: str) -> dict[str, Any]:
        """Handles drag-and-drop or browser-based file upload."""
        try:
            raw_bytes = base64.b64decode(content_base64)
            temp_path = Path.home() / ".snowpulse" / filename
            temp_path.parent.mkdir(parents=True, exist_ok=True)
            temp_path.write_bytes(raw_bytes)
            return self._load_raw_file(str(temp_path))
        except Exception as e:
            return {"success": False, "error": str(e)}

    def run_preprocessing(self, config_json: str) -> dict[str, Any]:
        """
        Executes data cleaning and preprocessing pipeline.
        Returns the before/after comparison and initializes the reactive dashboard state.
        """
        if self.raw_df is None:
            return {"success": False, "error": "No raw dataset loaded."}

        try:
            config = json.loads(config_json) if isinstance(config_json, str) else (config_json or {})
        except Exception:
            config = {}

        cleaned_df, report = NativeDataPreprocessor.clean(self.raw_df, config=config)
        self.clean_df = cleaned_df
        self.filtered_df = cleaned_df.clone()
        self.cleaning_report = report

        dataset_name = Path(self.dataset_path).name if self.dataset_path else "Cleaned_Dataset"
        self.analyzer = NativeDataAnalyzer(self.clean_df, name=dataset_name)
        self.chat_agent = NativeDataChatAgent(self.clean_df, dataset_name=dataset_name)

        # Build dashboard state for the cleaned data
        dash_data = self._compile_dashboard_data(self.clean_df)

        return {
            "success": True,
            "cleaning_report": report,
            "dashboard_data": dash_data,
        }

    def _compile_dashboard_data(self, df: pl.DataFrame) -> dict[str, Any]:
        """Compiles KPIs, smart charts, schema, correlations, and slicers for a DataFrame slice."""
        analyzer = NativeDataAnalyzer(df, name=Path(self.dataset_path).name if self.dataset_path else "Dataset")
        summary = analyzer.get_summary()
        col_stats = analyzer.get_column_stats()
        corrs = analyzer.get_top_correlations(top_n=6)
        signals = analyzer.get_signals()
        narratives = analyzer.generate_narrative()

        smart = analyzer.get_smart_chart_candidates()
        best_dim = smart["primary_dimension"]
        best_metric = smart["primary_metric"]

        # 1. Smart Category Chart (Dimension, NOT Identifier!)
        cat_labels = []
        cat_values = []
        cat_title = best_dim or "Categorical Dimension"
        if best_dim and best_dim in df.columns:
            vc = df[best_dim].drop_nulls().value_counts().sort("count", descending=True).head(8)
            cat_labels = [str(r[0]) for r in vc.iter_rows()]
            cat_values = [int(r[1]) for r in vc.iter_rows()]

        # 2. Continuous Metric Distribution
        num_labels = []
        num_values = []
        num_title = best_metric or "Metric Distribution"
        if best_metric and best_metric in df.columns:
            series = df[best_metric].drop_nulls()
            if len(series) > 0:
                counts, edges = np.histogram(series.to_numpy(), bins=10)
                num_labels = [f"{edges[i]:.1f}-{edges[i+1]:.1f}" for i in range(len(counts))]
                num_values = [int(c) for c in counts]

        # 3. Bivariate Chart (Metric by Dimension)
        bivariate_labels = []
        bivariate_values = []
        bivariate_title = f"{best_metric} by {best_dim}" if best_metric and best_dim else "Metric by Dimension"
        if best_metric and best_dim and best_metric in df.columns and best_dim in df.columns:
            grouped = df.group_by(best_dim).agg(pl.col(best_metric).mean().alias("avg_metric")).sort("avg_metric", descending=True).head(8)
            bivariate_labels = [str(r[0]) for r in grouped.iter_rows()]
            bivariate_values = [round(float(r[1]), 2) for r in grouped.iter_rows()]

        # 4. Preview Rows
        preview_rows = []
        if df.height > 0:
            for row in df.head(15).iter_rows():
                preview_rows.append([str(v) if v is not None else "" for v in row])

        # 5. Slicer Filter Options
        slicers = {}
        for dim in analyzer.dimension_cols[:4]:
            if dim in df.columns:
                unique_vals = [str(v) for v in df[dim].drop_nulls().unique().head(20).to_list()]
                slicers[dim] = sorted(unique_vals)

        return {
            "filename": Path(self.dataset_path).name if self.dataset_path else "Dataset",
            "summary": summary,
            "columns": col_stats,
            "dimensions": analyzer.dimension_cols,
            "metrics": analyzer.numeric_cols,
            "slicers": slicers,
            "chart_category": {"title": cat_title, "labels": cat_labels, "values": cat_values},
            "chart_numeric": {"title": num_title, "labels": num_labels, "values": num_values},
            "chart_bivariate": {"title": bivariate_title, "labels": bivariate_labels, "values": bivariate_values},
            "correlations": corrs,
            "signals": signals,
            "narratives": narratives,
            "preview_columns": df.columns,
            "preview_rows": preview_rows,
        }

    def apply_dashboard_filters(self, filters_json: str) -> dict[str, Any]:
        """
        Applies reactive filter slicers to the cleaned DataFrame.
        Re-aggregates all KPIs, charts, and tables dynamically in real-time.
        """
        if self.clean_df is None:
            return {"success": False, "error": "No cleaned dataset loaded."}

        try:
            filters = json.loads(filters_json) if isinstance(filters_json, str) else (filters_json or {})
        except Exception:
            filters = {}

        filtered = self.clean_df.clone()
        for col, val in filters.items():
            if val and val != "ALL" and col in filtered.columns:
                filtered = filtered.filter(pl.col(col) == val)

        self.filtered_df = filtered
        dash_data = self._compile_dashboard_data(filtered)
        return {"success": True, "dashboard_data": dash_data}

    def chat_query(self, question: str) -> dict[str, Any]:
        """Executes natural language queries on the cleaned dataset."""
        df_target = self.filtered_df if self.filtered_df is not None else (self.clean_df if self.clean_df is not None else self.raw_df)
        if df_target is None:
            return {"success": False, "error": "No dataset loaded. Please upload and clean a dataset first."}

        agent = NativeDataChatAgent(df_target, dataset_name=Path(self.dataset_path).name if self.dataset_path else "Dataset")
        res = agent.query(question)
        if not res.get("success"):
            return res

        res_df = res.get("result_df")
        rows = []
        cols = []
        if res_df is not None:
            cols = [str(c) for c in res_df.columns]
            for row in res_df.head(25).iter_rows():
                rows.append([str(v) if v is not None else "" for v in row])

        return {
            "success": True,
            "code": res.get("code"),
            "narrative": res.get("narrative"),
            "columns": cols,
            "rows": rows,
            "row_count": res.get("row_count", len(rows)),
        }

    def run_automl(self, target_column: str) -> dict[str, Any]:
        """Trains AutoML models on the clean dataset."""
        df_target = self.clean_df if self.clean_df is not None else self.raw_df
        if df_target is None:
            return {"success": False, "error": "No dataset loaded."}

        try:
            automl = NativeAutoMLEngine(df_target, target_col=target_column)
            results = automl.run_training()
            return {"success": True, "results": results}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def export_cleaned_dataset(self, file_format: str = "csv") -> dict[str, Any]:
        """Exports the cleaned dataset to disk."""
        if self.clean_df is None:
            return {"success": False, "error": "No cleaned dataset to export."}

        try:
            stem = Path(self.dataset_path).stem if self.dataset_path else "dataset"
            out_file = Path.home() / f"{stem}_cleaned.{file_format}"
            if file_format == "parquet":
                self.clean_df.write_parquet(out_file)
            else:
                self.clean_df.write_csv(out_file)
            return {"success": True, "filepath": str(out_file)}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def export_report_to_disk(self) -> dict[str, Any]:
        """Exports an interactive standalone HTML report."""
        df_target = self.clean_df if self.clean_df is not None else self.raw_df
        if df_target is None:
            return {"success": False, "error": "No dataset available."}

        try:
            stem = Path(self.dataset_path).stem if self.dataset_path else "dataset"
            out_file = Path.home() / f"{stem}_enterprise_report.html"
            generate_html_report(
                df_target,
                dataset_name=stem,
                output_path=out_file,
                cleaning_report=self.cleaning_report,
            )
            return {"success": True, "filepath": str(out_file)}
        except Exception as e:
            return {"success": False, "error": str(e)}


def build_app_html() -> str:
    """Builds the complete single-page offline dark glassmorphic HTML/JS/CSS application."""
    echarts_js = ""
    echarts_path = STATIC_DIR / "echarts.min.js"
    if echarts_path.exists():
        echarts_js = echarts_path.read_text(encoding="utf-8")

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SnowPulse AI — Autonomous Data Analyst</title>
    <style>
        :root {{
            --bg-dark: #070b14;
            --bg-card: rgba(14, 21, 37, 0.75);
            --bg-card-hover: rgba(22, 32, 54, 0.85);
            --border-dim: rgba(255, 255, 255, 0.08);
            --border-glow: rgba(0, 245, 255, 0.3);
            --accent-cyan: #00f5ff;
            --accent-blue: #38bdf8;
            --accent-green: #34d399;
            --accent-purple: #818cf8;
            --accent-red: #f87171;
            --text-main: #f8fafc;
            --text-muted: #94a3b8;
            --text-dim: #64748b;
        }}
        * {{ box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }}
        body {{
            background: var(--bg-dark);
            color: var(--text-main);
            height: 100vh;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            background-image: radial-gradient(circle at 10% 10%, rgba(0, 245, 255, 0.08) 0%, transparent 40%),
                              radial-gradient(circle at 90% 90%, rgba(56, 189, 248, 0.08) 0%, transparent 40%);
        }}
        header {{
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 24px;
            background: rgba(10, 15, 28, 0.95);
            border-bottom: 1px solid var(--border-dim);
            backdrop-filter: blur(16px);
            z-index: 10;
        }}
        .brand {{ display: flex; align-items: center; gap: 12px; }}
        .brand-icon {{
            width: 32px;
            height: 32px;
            border-radius: 8px;
            background: linear-gradient(135deg, #070b14, #0c1322);
            border: 1px solid var(--border-glow);
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 0 12px rgba(0, 245, 255, 0.25);
        }}
        .brand-title {{ font-size: 18px; font-weight: 800; letter-spacing: -0.02em; color: #fff; }}
        .brand-title span {{ color: var(--accent-cyan); font-weight: 400; font-size: 13px; margin-left: 6px; }}
        
        /* Workflow Stage Stepper */
        .stepper {{
            display: flex;
            align-items: center;
            gap: 8px;
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid var(--border-dim);
            padding: 4px 12px;
            border-radius: 9999px;
            font-size: 12px;
        }}
        .step-item {{ color: var(--text-dim); font-weight: 600; display: flex; align-items: center; gap: 4px; }}
        .step-item.active {{ color: var(--accent-cyan); font-weight: 700; }}
        .step-item.done {{ color: var(--accent-green); }}

        .header-actions {{ display: flex; align-items: center; gap: 10px; }}
        button {{
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid var(--border-dim);
            color: var(--text-main);
            padding: 8px 14px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
            display: inline-flex;
            align-items: center;
            gap: 6px;
        }}
        button:hover {{
            background: rgba(0, 245, 255, 0.12);
            border-color: var(--accent-cyan);
            color: #fff;
            box-shadow: 0 0 10px rgba(0, 245, 255, 0.2);
        }}
        button.btn-primary {{
            background: linear-gradient(135deg, #00f5ff, #0284c7);
            color: #070b14;
            border: none;
            font-weight: 700;
        }}
        button.btn-primary:hover {{
            box-shadow: 0 0 16px rgba(0, 245, 255, 0.5);
            transform: translateY(-1px);
        }}
        button.btn-success {{
            background: linear-gradient(135deg, #10b981, #059669);
            color: #fff;
            border: none;
            font-weight: 700;
        }}

        nav.tabs {{
            display: flex;
            gap: 6px;
            padding: 10px 24px;
            background: rgba(8, 12, 22, 0.7);
            border-bottom: 1px solid var(--border-dim);
        }}
        .tab-btn {{
            background: transparent;
            border: 1px solid transparent;
            color: var(--text-muted);
            padding: 6px 14px;
            font-size: 13px;
            border-radius: 6px;
        }}
        .tab-btn.active {{
            background: rgba(0, 245, 255, 0.15);
            color: var(--accent-cyan);
            border-color: rgba(0, 245, 255, 0.3);
            font-weight: 700;
        }}

        main {{
            flex: 1;
            overflow-y: auto;
            padding: 24px;
            position: relative;
        }}

        /* Views */
        .app-view {{ display: none; }}
        .app-view.active {{ display: block; }}

        /* Upload Workspace */
        .dropzone {{
            border: 2px dashed rgba(0, 245, 255, 0.3);
            background: rgba(14, 21, 37, 0.5);
            border-radius: 20px;
            padding: 60px 40px;
            text-align: center;
            cursor: pointer;
            transition: all 0.2s ease;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            margin-bottom: 30px;
        }}
        .dropzone:hover, .dropzone.dragover {{
            border-color: var(--accent-cyan);
            background: rgba(0, 245, 255, 0.05);
            box-shadow: 0 0 24px rgba(0, 245, 255, 0.2);
        }}
        .drop-icon {{ width: 64px; height: 64px; color: var(--accent-cyan); margin-bottom: 16px; }}
        .sample-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 16px;
        }}
        .sample-card {{
            background: var(--bg-card);
            border: 1px solid var(--border-dim);
            border-radius: 12px;
            padding: 16px 20px;
            cursor: pointer;
            transition: all 0.2s ease;
        }}
        .sample-card:hover {{
            border-color: var(--accent-cyan);
            background: var(--bg-card-hover);
            transform: translateY(-2px);
        }}

        /* Preprocessing & Cleaning Studio */
        .audit-hero {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
            margin-bottom: 24px;
        }}
        .audit-card {{
            background: var(--bg-card);
            border: 1px solid var(--border-dim);
            border-radius: 14px;
            padding: 18px;
        }}
        .studio-grid {{
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 24px;
        }}
        .config-card {{
            background: var(--bg-card);
            border: 1px solid var(--border-dim);
            border-radius: 14px;
            padding: 20px;
        }}
        .config-row {{
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 10px 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.04);
            font-size: 13px;
        }}
        select, input[type="text"] {{
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid var(--border-dim);
            color: #fff;
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 13px;
            outline: none;
        }}
        select option {{ background: #0c1322; color: #fff; }}

        /* Reactive Slicer Bar */
        .slicer-bar {{
            display: flex;
            align-items: center;
            gap: 14px;
            padding: 12px 18px;
            background: rgba(14, 21, 37, 0.85);
            border: 1px solid var(--border-dim);
            border-radius: 12px;
            margin-bottom: 20px;
            flex-wrap: wrap;
        }}
        .slicer-item {{ display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text-muted); font-weight: 600; }}

        /* KPI Cards */
        .kpi-row {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 16px;
            margin-bottom: 24px;
        }}
        .kpi-card {{
            background: var(--bg-card);
            border: 1px solid var(--border-dim);
            border-radius: 14px;
            padding: 16px 20px;
            backdrop-filter: blur(12px);
        }}
        .kpi-label {{ font-size: 11px; text-transform: uppercase; color: var(--text-dim); font-weight: 700; letter-spacing: 0.05em; }}
        .kpi-value {{ font-size: 28px; font-weight: 800; color: #fff; margin: 4px 0; }}
        .kpi-sub {{ font-size: 12px; color: var(--text-muted); }}

        /* Cards & Grids */
        .panel-card {{
            background: var(--bg-card);
            border: 1px solid var(--border-dim);
            border-radius: 14px;
            padding: 20px;
            margin-bottom: 20px;
            backdrop-filter: blur(12px);
        }}
        .panel-title {{ font-size: 16px; font-weight: 700; margin-bottom: 14px; display: flex; align-items: center; justify-content: space-between; }}
        .charts-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(460px, 1fr));
            gap: 20px;
            margin-bottom: 24px;
        }}
        .chart-box {{ width: 100%; height: 300px; }}

        /* Tables */
        table {{
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
        }}
        th {{
            text-align: left;
            padding: 10px 14px;
            background: rgba(255, 255, 255, 0.03);
            color: var(--text-muted);
            border-bottom: 1px solid var(--border-dim);
            font-size: 11px;
            text-transform: uppercase;
            font-weight: 700;
        }}
        td {{
            padding: 10px 14px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.04);
            color: var(--text-main);
        }}
        tr:hover td {{ background: rgba(255, 255, 255, 0.02); }}
        .tag {{
            display: inline-block;
            padding: 2px 8px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 600;
        }}
        .tag-metric {{ background: rgba(0, 245, 255, 0.15); color: var(--accent-cyan); }}
        .tag-dim {{ background: rgba(129, 140, 248, 0.15); color: var(--accent-purple); }}
        .tag-time {{ background: rgba(234, 179, 8, 0.15); color: #facc15; }}
        .tag-alert {{ background: rgba(248, 113, 113, 0.15); color: var(--accent-red); }}

        /* Chat view */
        .chat-container {{
            display: flex;
            flex-direction: column;
            height: calc(100vh - 170px);
            background: var(--bg-card);
            border: 1px solid var(--border-dim);
            border-radius: 14px;
            overflow: hidden;
        }}
        .chat-messages {{
            flex: 1;
            overflow-y: auto;
            padding: 20px;
            display: flex;
            flex-direction: column;
            gap: 16px;
        }}
        .chat-msg {{
            max-width: 85%;
            padding: 14px 18px;
            border-radius: 12px;
            font-size: 14px;
            line-height: 1.5;
        }}
        .msg-user {{
            align-self: flex-end;
            background: linear-gradient(135deg, #0284c7, #0369a1);
            color: #fff;
            border-bottom-right-radius: 4px;
        }}
        .msg-ai {{
            align-self: flex-start;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid var(--border-dim);
            color: var(--text-main);
            border-bottom-left-radius: 4px;
        }}
        .code-pill {{
            background: rgba(0, 0, 0, 0.4);
            border: 1px solid rgba(255, 255, 255, 0.1);
            padding: 8px 12px;
            border-radius: 6px;
            font-family: monospace;
            font-size: 12px;
            color: var(--accent-cyan);
            margin-top: 10px;
            white-space: pre-wrap;
            word-break: break-all;
        }}
        .chat-input-bar {{
            padding: 14px 20px;
            background: rgba(10, 15, 28, 0.95);
            border-top: 1px solid var(--border-dim);
            display: flex;
            gap: 10px;
        }}
        .chat-input {{
            flex: 1;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid var(--border-dim);
            color: #fff;
            padding: 10px 16px;
            border-radius: 8px;
            font-size: 14px;
            outline: none;
        }}
        .chat-input:focus {{ border-color: var(--accent-cyan); }}

        /* Status alert banner */
        .alert-banner {{
            padding: 12px 18px;
            background: rgba(52, 211, 153, 0.15);
            border: 1px solid rgba(52, 211, 153, 0.3);
            border-radius: 8px;
            color: #34d399;
            font-size: 13px;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 10px;
        }}
    </style>
    <script>
        {echarts_js}
    </script>
</head>
<body>
    <header>
        <div class="brand">
            <div class="brand-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00f5ff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                </svg>
            </div>
            <div>
                <div class="brand-title">SnowPulse AI <span>Production Data Analyst</span></div>
            </div>
        </div>

        <!-- Pipeline Stepper -->
        <div class="stepper">
            <span id="step-1" class="step-item active">1. Ingest Dataset</span> ➔
            <span id="step-2" class="step-item">2. Clean & Preprocess</span> ➔
            <span id="step-3" class="step-item">3. Reactive Intelligence</span>
        </div>

        <div class="header-actions">
            <button onclick="goToUploadView()">📂 New Dataset</button>
            <button class="btn-primary" onclick="openFileDialog()">Browse File...</button>
            <button onclick="exportCleanedData()">💾 Export Clean Data</button>
            <button onclick="exportReport()">📑 Export HTML Report</button>
        </div>
    </header>

    <!-- Navigation Tabs (Active in Dashboard Stage) -->
    <nav id="main-tabs" class="tabs" style="display: none;">
        <button class="tab-btn active" onclick="switchDashTab('tab-insights', this)">📊 Intelligence Dashboard</button>
        <button class="tab-btn" onclick="switchDashTab('tab-chat', this)">💬 Conversational AI</button>
        <button class="tab-btn" onclick="switchDashTab('tab-automl', this)">⚡ AutoML Predictor</button>
        <button class="tab-btn" onclick="switchDashTab('tab-preview', this)">📋 Cleaned Data</button>
        <button class="tab-btn" onclick="switchDashTab('tab-clean-audit', this)">✨ Cleaning Recipe</button>
    </nav>

    <main>
        <!-- ============================================================== -->
        <!-- VIEW 1: UPLOAD & INGESTION HUB -->
        <!-- ============================================================== -->
        <div id="view-upload" class="app-view active">
            <div class="dropzone" id="file-dropzone" onclick="openFileDialog()">
                <svg class="drop-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
                <h2 style="font-size: 22px; font-weight: 700; margin-bottom: 8px;">Upload Your Tabular Dataset</h2>
                <p style="color: var(--text-muted); font-size: 14px; max-width: 480px; margin-bottom: 18px;">
                    Drop any CSV, TSV, Parquet, Excel, JSON, or SQLite database here or click to browse.
                    SnowPulse will audit quality, execute preprocessing, and build reactive visual analytics.
                </p>
                <button class="btn-primary" onclick="event.stopPropagation(); openFileDialog();">Select File From Computer</button>
            </div>

            <div style="font-size: 14px; font-weight: 700; margin-bottom: 12px; color: var(--text-muted);">
                OR TEST WITH ENTERPRISE SAMPLE BENCHMARKS:
            </div>
            <div class="sample-grid">
                <div class="sample-card" onclick="loadSample()">
                    <div style="font-size: 16px; font-weight: 700; color: #fff; margin-bottom: 4px;">📊 SaaS Churn & Revenue Analytics</div>
                    <div style="font-size: 12px; color: var(--text-muted);">200 records | Contains missing values, outliers, customer tiers, and MRR.</div>
                </div>
            </div>
        </div>

        <!-- ============================================================== -->
        <!-- VIEW 2: DATA AUDIT & PREPROCESSING STUDIO -->
        <!-- ============================================================== -->
        <div id="view-clean-studio" class="app-view">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <div>
                    <h2 id="studio-filename" style="font-size: 20px; font-weight: 800;">Dataset Audit & Cleaning Studio</h2>
                    <p style="color: var(--text-muted); font-size: 13px;">Review raw health audit, configure preprocessing rules, and generate clean intelligence assets.</p>
                </div>
                <div style="display: flex; gap: 10px;">
                    <button class="btn-primary" onclick="applyPreprocessing(true)">⚡ 1-Click Auto-Clean & Launch Dashboard</button>
                </div>
            </div>

            <!-- Audit Hero KPI Cards -->
            <div class="audit-hero">
                <div class="audit-card">
                    <div class="kpi-label">Raw Health Score</div>
                    <div id="audit-health" class="kpi-value" style="color: var(--accent-cyan);">96.3%</div>
                    <div id="audit-health-sub" class="kpi-sub">Pre-Cleaning Baseline</div>
                </div>
                <div class="audit-card">
                    <div class="kpi-label">Raw Records</div>
                    <div id="audit-rows" class="kpi-value">200</div>
                    <div id="audit-cols" class="kpi-sub">8 Columns</div>
                </div>
                <div class="audit-card">
                    <div class="kpi-label">Missing Cells</div>
                    <div id="audit-missing" class="kpi-value" style="color: #facc15;">14</div>
                    <div class="kpi-sub">Requiring Imputation</div>
                </div>
                <div class="audit-card">
                    <div class="kpi-label">Outlier Attributes</div>
                    <div id="audit-outliers" class="kpi-value" style="color: #f87171;">1</div>
                    <div class="kpi-sub">Exceeding 1.5× IQR Bounds</div>
                </div>
            </div>

            <!-- Configuration & Audit Breakdown -->
            <div class="studio-grid">
                <div class="config-card">
                    <div class="panel-title">🛠️ Preprocessing Strategy Controls</div>
                    
                    <div class="config-row">
                        <span>Missing Numeric Strategy:</span>
                        <select id="cfg-missing-num">
                            <option value="median" selected>Impute with Median (Robust to outliers)</option>
                            <option value="mean">Impute with Mean</option>
                            <option value="zero">Fill with Zero</option>
                            <option value="drop_rows">Drop Incomplete Rows</option>
                        </select>
                    </div>

                    <div class="config-row">
                        <span>Missing Categorical Strategy:</span>
                        <select id="cfg-missing-cat">
                            <option value="mode" selected>Impute with Mode (Most Frequent)</option>
                            <option value="constant">Fill with 'Unknown'</option>
                            <option value="drop_rows">Drop Incomplete Rows</option>
                        </select>
                    </div>

                    <div class="config-row">
                        <span>Outlier Remediation:</span>
                        <select id="cfg-outliers">
                            <option value="clip" selected>Winsorize to IQR Fences (Cap extremes)</option>
                            <option value="drop">Filter Out Outlier Rows</option>
                            <option value="keep">Keep Raw Outliers As-Is</option>
                        </select>
                    </div>

                    <div class="config-row">
                        <span>Remove Exact Duplicate Rows:</span>
                        <input type="checkbox" id="cfg-dedup" checked style="transform: scale(1.3); cursor: pointer;" />
                    </div>

                    <div class="config-row">
                        <span>Standardize Text & Null Tokens ('N/A', 'null'):</span>
                        <input type="checkbox" id="cfg-normalize" checked style="transform: scale(1.3); cursor: pointer;" />
                    </div>

                    <div class="config-row">
                        <span>Parse Date & Temporal Fields:</span>
                        <input type="checkbox" id="cfg-dates" checked style="transform: scale(1.3); cursor: pointer;" />
                    </div>

                    <div style="margin-top: 20px; display: flex; gap: 10px;">
                        <button class="btn-success" style="width: 100%; justify-content: center; padding: 12px;" onclick="applyPreprocessing(false)">
                            Apply Transformations & Launch Reactive Dashboard ❯
                        </button>
                    </div>
                </div>

                <div class="config-card">
                    <div class="panel-title">📋 Raw Quality Diagnostic Log</div>
                    <div id="audit-log" style="display: flex; flex-direction: column; gap: 10px; max-height: 340px; overflow-y: auto;"></div>
                </div>
            </div>

            <!-- Raw Preview Table -->
            <div class="panel-card" style="overflow-x: auto;">
                <div class="panel-title">Raw Data Sample (Pre-Cleaning)</div>
                <table>
                    <thead id="audit-raw-thead"></thead>
                    <tbody id="audit-raw-tbody"></tbody>
                </table>
            </div>
        </div>

        <!-- ============================================================== -->
        <!-- VIEW 3: REACTIVE INTELLIGENCE DASHBOARD -->
        <!-- ============================================================== -->
        <div id="view-dashboard" class="app-view">
            <!-- Active Slicers Bar -->
            <div class="slicer-bar">
                <span style="font-size: 13px; font-weight: 700; color: var(--accent-cyan);">⚡ Reactive Filter Slicers:</span>
                <div id="slicer-controls" style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;"></div>
                <button onclick="resetSlicers()" style="padding: 4px 10px; font-size: 12px;">Reset Filters</button>
            </div>

            <!-- Subtab 1: Insights & Visualizations -->
            <div id="tab-insights" class="tab-pane active">
                <div class="kpi-row">
                    <div class="kpi-card">
                        <div class="kpi-label">Data Health Score</div>
                        <div id="kpi-health" class="kpi-value" style="color: var(--accent-green);">100%</div>
                        <div class="kpi-sub">Cleaned & Standardized</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-label">Active Records</div>
                        <div id="kpi-rows" class="kpi-value">200</div>
                        <div id="kpi-cols-sub" class="kpi-sub">8 Columns | 0.01 MB</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-label">Missing Values</div>
                        <div id="kpi-missing" class="kpi-value" style="color: #34d399;">0</div>
                        <div class="kpi-sub">100% Imputed / Resolved</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-label">Multivariate Anomalies</div>
                        <div id="kpi-signals" class="kpi-value" style="color: var(--accent-cyan);">2</div>
                        <div class="kpi-sub">Statistical Signals Detected</div>
                    </div>
                </div>

                <!-- Executive Narrative -->
                <div class="panel-card">
                    <div class="panel-title">🧠 AI Executive Insights & Narrative</div>
                    <div id="narrative-list" style="display: flex; flex-direction: column; gap: 8px;"></div>
                </div>

                <!-- Smart Visual Analytics -->
                <div class="charts-grid">
                    <div class="panel-card">
                        <div id="chart-cat-title" class="panel-title">📊 Category Breakdown</div>
                        <div id="chart-cat" class="chart-box"></div>
                    </div>
                    <div class="panel-card">
                        <div id="chart-num-title" class="panel-title">📈 Metric Distribution</div>
                        <div id="chart-num" class="chart-box"></div>
                    </div>
                </div>

                <div class="charts-grid">
                    <div class="panel-card">
                        <div id="chart-bi-title" class="panel-title">🔗 Bivariate Analysis (Metric by Dimension)</div>
                        <div id="chart-bi" class="chart-box"></div>
                    </div>
                    <div class="panel-card">
                        <div class="panel-title">⚡ Autonomous Statistical Signals</div>
                        <div id="signals-list" style="display: flex; flex-direction: column; gap: 10px;"></div>
                    </div>
                </div>

                <!-- Schema Profile Table -->
                <div class="panel-card">
                    <div class="panel-title">📑 Comprehensive Cleaned Schema Profile</div>
                    <table>
                        <thead>
                            <tr>
                                <th>Column</th>
                                <th>Role</th>
                                <th>Type</th>
                                <th>Missing %</th>
                                <th>Summary / Stats</th>
                            </tr>
                        </thead>
                        <tbody id="schema-tbody"></tbody>
                    </table>
                </div>
            </div>

            <!-- Subtab 2: Conversational AI -->
            <div id="tab-chat" class="tab-pane" style="display: none;">
                <div class="chat-container">
                    <div id="chat-messages" class="chat-messages">
                        <div class="chat-msg msg-ai">
                            👋 Hello! I am your native SnowPulse data scientist. Ask any question about your clean data (e.g. <i>"show top 5 rows"</i>, <i>"average mrr by plan_tier"</i>, <i>"how many records in Europe"</i>).
                        </div>
                    </div>
                    <div class="chat-input-bar">
                        <input id="chat-input" class="chat-input" placeholder="Ask a question about your clean dataset..." onkeydown="if(event.key==='Enter') sendChat()" />
                        <button class="btn-primary" onclick="sendChat()">Send ❯</button>
                    </div>
                </div>
            </div>

            <!-- Subtab 3: AutoML Predictor -->
            <div id="tab-automl" class="tab-pane" style="display: none;">
                <div class="panel-card">
                    <div class="panel-title">⚡ Autonomous Machine Learning Trainer</div>
                    <div style="display: flex; align-items: center; gap: 14px; margin-bottom: 20px;">
                        <label style="font-size: 13px; font-weight: 600;">Target Column:</label>
                        <select id="automl-target"></select>
                        <button id="btn-run-automl" class="btn-primary" onclick="runAutoML()">Train Best Model</button>
                    </div>
                    <div id="automl-status" style="font-size: 13px; color: var(--text-muted); margin-bottom: 14px;"></div>
                    <div id="automl-results" style="display: none;">
                        <div class="kpi-row" style="margin-top: 16px;">
                            <div class="kpi-card">
                                <div class="kpi-label">Champion Model</div>
                                <div id="automl-best-model" class="kpi-value" style="color: var(--accent-cyan); font-size: 22px;">GradientBoosting</div>
                                <div id="automl-task" class="kpi-sub">Classification</div>
                            </div>
                            <div class="kpi-card">
                                <div class="kpi-label">Primary Metric</div>
                                <div id="automl-primary-metric" class="kpi-value" style="color: #34d399; font-size: 22px;">1.000</div>
                                <div id="automl-metric-name" class="kpi-sub">Accuracy</div>
                            </div>
                        </div>

                        <div class="panel-card" style="margin-top: 16px;">
                            <div class="panel-title">Top 10 Feature Importances</div>
                            <div id="chart-importances" class="chart-box" style="height: 280px;"></div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Subtab 4: Cleaned Data Preview -->
            <div id="tab-preview" class="tab-pane" style="display: none;">
                <div class="panel-card" style="overflow-x: auto;">
                    <div class="panel-title">📋 Cleaned Dataset Rows (Top 15)</div>
                    <table>
                        <thead id="preview-thead"></thead>
                        <tbody id="preview-tbody"></tbody>
                    </table>
                </div>
            </div>

            <!-- Subtab 5: Cleaning Audit Recipe -->
            <div id="tab-clean-audit" class="tab-pane" style="display: none;">
                <div class="panel-card">
                    <div class="panel-title">✨ Executed Data Preprocessing & Cleaning Audit</div>
                    <div id="audit-recipe-summary" style="margin-bottom: 20px;"></div>
                    <div id="audit-recipe-steps" style="display: flex; flex-direction: column; gap: 8px;"></div>
                </div>
            </div>
        </div>
    </main>

    <script>
        let rawAuditData = null;
        let currentDashData = null;
        let activeFilters = {{}};

        let catChart = null;
        let numChart = null;
        let biChart = null;
        let featChart = null;

        function setStep(stepNum) {{
            document.querySelectorAll('.step-item').forEach((el, idx) => {{
                el.classList.remove('active', 'done');
                if (idx + 1 === stepNum) el.classList.add('active');
                if (idx + 1 < stepNum) el.classList.add('done');
            }});
        }}

        function goToUploadView() {{
            document.getElementById('view-upload').classList.add('active');
            document.getElementById('view-clean-studio').classList.remove('active');
            document.getElementById('view-dashboard').classList.remove('active');
            document.getElementById('main-tabs').style.display = 'none';
            setStep(1);
        }}

        function openFileDialog() {{
            if (window.pywebview && window.pywebview.api) {{
                window.pywebview.api.select_file_dialog().then(renderAuditStudio);
            }}
        }}

        function loadSample() {{
            if (window.pywebview && window.pywebview.api) {{
                window.pywebview.api.load_sample_dataset().then(renderAuditStudio);
            }}
        }}

        // Render Studio when dataset is uploaded
        function renderAuditStudio(data) {{
            if (!data || data.cancelled || !data.success) return;
            rawAuditData = data;

            document.getElementById('view-upload').classList.remove('active');
            document.getElementById('view-clean-studio').classList.add('active');
            document.getElementById('view-dashboard').classList.remove('active');
            document.getElementById('main-tabs').style.display = 'none';
            setStep(2);

            document.getElementById('studio-filename').innerText = 'Dataset Audit & Cleaning: ' + data.filename;
            document.getElementById('audit-health').innerText = data.audit.raw_health_score + '%';
            document.getElementById('audit-rows').innerText = data.rows.toLocaleString();
            document.getElementById('audit-cols').innerText = data.columns_count + ' Columns';
            document.getElementById('audit-missing').innerText = data.audit.total_missing_cells.toLocaleString();
            document.getElementById('audit-outliers').innerText = data.audit.outlier_columns.length;

            // Audit Diagnostics List
            const logBox = document.getElementById('audit-log');
            logBox.innerHTML = '';

            if (data.audit.total_missing_cells > 0) {{
                data.audit.columns_with_missing.forEach(col => {{
                    logBox.innerHTML += `<div style="padding: 10px; background: rgba(250, 204, 21, 0.1); border-left: 3px solid #facc15; border-radius: 6px; font-size: 13px;">
                        <b>Missing Values:</b> Found <b>${{col.null_count}} nulls</b> (${{col.null_pct}}%) in <code>${{col.column}}</code> (${{col.dtype}}). Recommended: <b>${{col.suggested_strategy}}</b>.
                    </div>`;
                }});
            }}

            if (data.audit.outlier_columns.length > 0) {{
                data.audit.outlier_columns.forEach(o => {{
                    logBox.innerHTML += `<div style="padding: 10px; background: rgba(248, 113, 113, 0.1); border-left: 3px solid #f87171; border-radius: 6px; font-size: 13px;">
                        <b>Outlier Bounds:</b> Found <b>${{o.outlier_count}} outliers</b> in <code>${{o.column}}</code> beyond IQR fences [${{o.lower_bound}}, ${{o.upper_bound}}].
                    </div>`;
                }});
            }}

            if (data.audit.detected_identifiers.length > 0) {{
                data.audit.detected_identifiers.forEach(idCol => {{
                    logBox.innerHTML += `<div style="padding: 10px; background: rgba(129, 140, 248, 0.1); border-left: 3px solid #818cf8; border-radius: 6px; font-size: 13px;">
                        <b>Identifier Detected:</b> <code>${{idCol}}</code> is an ID/key column. Filtered out from category visualizations.
                    </div>`;
                }});
            }}

            if (data.audit.duplicate_rows_count === 0 && data.audit.total_missing_cells === 0 && data.audit.outlier_columns.length === 0) {{
                logBox.innerHTML = '<div style="padding: 12px; color: #34d399;">✓ Dataset is clean and ready for analysis!</div>';
            }}

            // Raw Preview Table
            const rHead = document.getElementById('audit-raw-thead');
            rHead.innerHTML = '<tr>' + data.preview_columns.map(c => '<th>' + c + '</th>').join('') + '</tr>';
            const rBody = document.getElementById('audit-raw-tbody');
            rBody.innerHTML = '';
            data.preview_rows.forEach(r => {{
                rBody.innerHTML += '<tr>' + r.map(v => '<td>' + v + '</td>').join('') + '</tr>';
            }});
        }}

        function applyPreprocessing(isAuto) {{
            const config = {{
                deduplicate: document.getElementById('cfg-dedup').checked,
                missing_numeric_strategy: isAuto ? 'median' : document.getElementById('cfg-missing-num').value,
                missing_categorical_strategy: isAuto ? 'mode' : document.getElementById('cfg-missing-cat').value,
                outlier_strategy: isAuto ? 'clip' : document.getElementById('cfg-outliers').value,
                normalize_text: document.getElementById('cfg-normalize').checked,
                parse_dates: document.getElementById('cfg-dates').checked,
            }};

            if (window.pywebview && window.pywebview.api) {{
                window.pywebview.api.run_preprocessing(JSON.stringify(config)).then(res => {{
                    if (res.success) {{
                        renderDashboard(res.dashboard_data, res.cleaning_report);
                    }} else {{
                        alert('Cleaning failed: ' + res.error);
                    }}
                }});
            }}
        }}

        function renderDashboard(dash, cleanReport) {{
            currentDashData = dash;
            activeFilters = {{}};

            document.getElementById('view-upload').classList.remove('active');
            document.getElementById('view-clean-studio').classList.remove('active');
            document.getElementById('view-dashboard').classList.add('active');
            document.getElementById('main-tabs').style.display = 'flex';
            setStep(3);

            // KPIs
            document.getElementById('kpi-health').innerText = dash.summary.quality_score + '%';
            document.getElementById('kpi-rows').innerText = dash.summary.rows.toLocaleString();
            document.getElementById('kpi-cols-sub').innerText = dash.summary.columns + ' Columns | ' + dash.summary.memory_mb + ' MB';
            document.getElementById('kpi-missing').innerText = dash.summary.total_missing.toLocaleString();
            document.getElementById('kpi-signals').innerText = dash.signals.length;

            // Slicers Bar
            renderSlicers(dash.slicers);

            // Narratives
            const nList = document.getElementById('narrative-list');
            nList.innerHTML = '';
            dash.narratives.forEach(n => {{
                const d = document.createElement('div');
                d.style.padding = '8px 12px';
                d.style.background = 'rgba(255,255,255,0.02)';
                d.style.borderLeft = '3px solid var(--accent-cyan)';
                d.style.borderRadius = '6px';
                d.style.fontSize = '13px';
                d.innerHTML = n.replace(/\\*\\*(.*?)\\*\\*/g, '<b>$1</b>').replace(/`(.*?)`/g, '<code style="color:var(--accent-cyan);">$1</code>');
                nList.appendChild(d);
            }});

            // Signals List
            const sigBox = document.getElementById('signals-list');
            sigBox.innerHTML = '';
            if (dash.signals.length > 0) {{
                dash.signals.forEach(s => {{
                    sigBox.innerHTML += `<div style="padding: 10px; background: rgba(0, 245, 255, 0.05); border-left: 3px solid var(--accent-cyan); border-radius: 6px; font-size: 13px;">
                        <b>${{s.title}}:</b> ${{s.description}}
                    </div>`;
                }});
            }} else {{
                sigBox.innerHTML = '<div style="color: var(--text-muted);">No significant anomalies detected.</div>';
            }}

            // Schema Table
            const sBody = document.getElementById('schema-tbody');
            sBody.innerHTML = '';
            dash.columns.forEach(c => {{
                const tr = document.createElement('tr');
                const roleTag = c.role === 'metric' ? 'tag-metric' : (c.role === 'dimension' ? 'tag-dim' : 'tag-time');
                const details = c.top_values || ('mean: ' + (c.mean || 'N/A') + ' | min: ' + (c.min || 'N/A') + ' | max: ' + (c.max || 'N/A'));
                tr.innerHTML = `
                    <td><b>${{c.name}}</b></td>
                    <td><span class="tag ${{roleTag}}">${{c.role}}</span></td>
                    <td>${{c.dtype}}</td>
                    <td>${{c.missing_pct}}%</td>
                    <td style="color: var(--text-muted); font-size: 12px;">${{details}}</td>
                `;
                sBody.appendChild(tr);
            }});

            // AutoML Dropdown
            const autoSelect = document.getElementById('automl-target');
            autoSelect.innerHTML = '';
            dash.columns.forEach(c => {{
                if (c.role !== 'identifier') {{
                    const opt = document.createElement('option');
                    opt.value = c.name;
                    opt.innerText = c.name + ' (' + c.role + ')';
                    autoSelect.appendChild(opt);
                }}
            }});

            // Data Preview
            const pHead = document.getElementById('preview-thead');
            pHead.innerHTML = '<tr>' + dash.preview_columns.map(c => '<th>' + c + '</th>').join('') + '</tr>';
            const pBody = document.getElementById('preview-tbody');
            pBody.innerHTML = '';
            dash.preview_rows.forEach(r => {{
                pBody.innerHTML += '<tr>' + r.map(v => '<td>' + v + '</td>').join('') + '</tr>';
            }});

            // Cleaning Audit Recipe Tab
            if (cleanReport) {{
                const sumBox = document.getElementById('audit-recipe-summary');
                sumBox.innerHTML = `
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px;">
                        <div style="background: rgba(255,255,255,0.03); padding: 12px; border-radius: 8px;">
                            <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase;">Health Score Gain</div>
                            <div style="font-size: 20px; font-weight: 700; color: #34d399;">${{cleanReport.initial_health_score}}% ➔ ${{cleanReport.final_health_score}}%</div>
                        </div>
                        <div style="background: rgba(255,255,255,0.03); padding: 12px; border-radius: 8px;">
                            <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase;">Missing Resolved</div>
                            <div style="font-size: 20px; font-weight: 700; color: #fff;">${{cleanReport.missing_resolved}}</div>
                        </div>
                        <div style="background: rgba(255,255,255,0.03); padding: 12px; border-radius: 8px;">
                            <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase;">Duplicates Removed</div>
                            <div style="font-size: 20px; font-weight: 700; color: #fff;">${{cleanReport.duplicates_removed}}</div>
                        </div>
                    </div>
                `;
                const stepBox = document.getElementById('audit-recipe-steps');
                stepBox.innerHTML = '';
                cleanReport.transformations.forEach(t => {{
                    stepBox.innerHTML += `<div style="padding: 10px 14px; background: rgba(52, 211, 153, 0.08); border-left: 3px solid #34d399; border-radius: 6px; font-size: 13px;">✓ ${{t}}</div>`;
                }});
            }}

            // Render Charts
            renderCharts(dash);
        }}

        function renderSlicers(slicers) {{
            const box = document.getElementById('slicer-controls');
            box.innerHTML = '';
            for (const [col, vals] of Object.entries(slicers)) {{
                const item = document.createElement('div');
                item.className = 'slicer-item';
                item.innerHTML = `<span>${{col}}:</span>`;
                const sel = document.createElement('select');
                sel.innerHTML = `<option value="ALL">All ${{col}}</option>` + vals.map(v => `<option value="${{v}}">${{v}}</option>`).join('');
                sel.onchange = (e) => onSlicerChange(col, e.target.value);
                item.appendChild(sel);
                box.appendChild(item);
            }}
        }}

        function onSlicerChange(col, val) {{
            if (val === 'ALL') {{
                delete activeFilters[col];
            }} else {{
                activeFilters[col] = val;
            }}
            if (window.pywebview && window.pywebview.api) {{
                window.pywebview.api.apply_dashboard_filters(JSON.stringify(activeFilters)).then(res => {{
                    if (res.success) {{
                        renderDashboard(res.dashboard_data, null);
                    }}
                }});
            }}
        }}

        function resetSlicers() {{
            activeFilters = {{}};
            document.querySelectorAll('#slicer-controls select').forEach(s => s.value = 'ALL');
            if (window.pywebview && window.pywebview.api) {{
                window.pywebview.api.apply_dashboard_filters(JSON.stringify({{}})).then(res => {{
                    if (res.success) renderDashboard(res.dashboard_data, null);
                }});
            }}
        }}

        function renderCharts(data) {{
            if (typeof echarts === 'undefined') return;

            // 1. Smart Category Chart (Dimension, NOT ID!)
            if (data.chart_category && data.chart_category.labels.length > 0) {{
                document.getElementById('chart-cat-title').innerText = '📊 ' + data.chart_category.title + ' Breakdown';
                const el = document.getElementById('chart-cat');
                if (catChart) catChart.dispose();
                catChart = echarts.init(el);
                catChart.setOption({{
                    backgroundColor: 'transparent',
                    tooltip: {{ trigger: 'axis' }},
                    xAxis: {{ type: 'category', data: data.chart_category.labels, axisLabel: {{ color: '#94a3b8', rotate: 20 }} }},
                    yAxis: {{ type: 'value', splitLine: {{ lineStyle: {{ color: 'rgba(255,255,255,0.06)' }} }}, axisLabel: {{ color: '#94a3b8' }} }},
                    series: [{{
                        data: data.chart_category.values,
                        type: 'bar',
                        itemStyle: {{ color: '#00f5ff', borderRadius: [4, 4, 0, 0] }}
                    }}]
                }});
            }}

            // 2. Numeric Distribution Chart
            if (data.chart_numeric && data.chart_numeric.labels.length > 0) {{
                document.getElementById('chart-num-title').innerText = '📈 ' + data.chart_numeric.title + ' Distribution';
                const el2 = document.getElementById('chart-num');
                if (numChart) numChart.dispose();
                numChart = echarts.init(el2);
                numChart.setOption({{
                    backgroundColor: 'transparent',
                    tooltip: {{ trigger: 'axis' }},
                    xAxis: {{ type: 'category', data: data.chart_numeric.labels, axisLabel: {{ color: '#94a3b8', rotate: 20 }} }},
                    yAxis: {{ type: 'value', splitLine: {{ lineStyle: {{ color: 'rgba(255,255,255,0.06)' }} }}, axisLabel: {{ color: '#94a3b8' }} }},
                    series: [{{
                        data: data.chart_numeric.values,
                        type: 'line',
                        smooth: true,
                        areaStyle: {{ color: 'rgba(0, 245, 255, 0.2)' }},
                        itemStyle: {{ color: '#38bdf8' }}
                    }}]
                }});
            }}

            // 3. Bivariate Chart (Metric by Dimension)
            if (data.chart_bivariate && data.chart_bivariate.labels.length > 0) {{
                document.getElementById('chart-bi-title').innerText = '🔗 ' + data.chart_bivariate.title;
                const el3 = document.getElementById('chart-bi');
                if (biChart) biChart.dispose();
                biChart = echarts.init(el3);
                biChart.setOption({{
                    backgroundColor: 'transparent',
                    tooltip: {{ trigger: 'axis' }},
                    xAxis: {{ type: 'category', data: data.chart_bivariate.labels, axisLabel: {{ color: '#94a3b8', rotate: 20 }} }},
                    yAxis: {{ type: 'value', splitLine: {{ lineStyle: {{ color: 'rgba(255,255,255,0.06)' }} }}, axisLabel: {{ color: '#94a3b8' }} }},
                    series: [{{
                        data: data.chart_bivariate.values,
                        type: 'bar',
                        itemStyle: {{ color: '#818cf8', borderRadius: [4, 4, 0, 0] }}
                    }}]
                }});
            }}
        }}

        function switchDashTab(tabId, btn) {{
            document.querySelectorAll('#view-dashboard .tab-pane').forEach(el => el.style.display = 'none');
            document.querySelectorAll('#main-tabs .tab-btn').forEach(el => el.classList.remove('active'));
            const pane = document.getElementById(tabId);
            if (pane) pane.style.display = 'block';
            if (btn) btn.classList.add('active');
            setTimeout(() => {{
                if (catChart) catChart.resize();
                if (numChart) numChart.resize();
                if (biChart) biChart.resize();
                if (featChart) featChart.resize();
            }}, 50);
        }}

        function sendChat() {{
            const input = document.getElementById('chat-input');
            const q = input.value.trim();
            if (!q) return;

            const box = document.getElementById('chat-messages');
            box.innerHTML += `<div class="chat-msg msg-user">${{q}}</div>`;
            input.value = '';
            box.scrollTop = box.scrollHeight;

            if (window.pywebview && window.pywebview.api) {{
                window.pywebview.api.chat_query(q).then(res => {{
                    if (res.success) {{
                        let html = `<div class="chat-msg msg-ai"><div>${{res.narrative}}</div>`;
                        if (res.rows && res.rows.length > 0) {{
                            html += '<table style="margin-top:10px; font-size:12px;"><thead><tr>' + res.columns.map(c => '<th>' + c + '</th>').join('') + '</tr></thead><tbody>';
                            res.rows.slice(0, 10).forEach(r => {{
                                html += '<tr>' + r.map(v => '<td>' + v + '</td>').join('') + '</tr>';
                            }});
                            html += '</tbody></table>';
                        }}
                        if (res.code) {{
                            html += `<div class="code-pill">⚡ Polars: ${{res.code}}</div>`;
                        }}
                        html += `</div>`;
                        box.innerHTML += html;
                    }} else {{
                        box.innerHTML += `<div class="chat-msg msg-ai" style="color: #f87171;">⚠️ ${{res.error}}</div>`;
                    }}
                    box.scrollTop = box.scrollHeight;
                }});
            }}
        }}

        function runAutoML() {{
            const target = document.getElementById('automl-target').value;
            const status = document.getElementById('automl-status');
            const btn = document.getElementById('btn-run-automl');
            btn.disabled = true;
            status.innerText = 'Training candidate models on cleaned dataset...';

            if (window.pywebview && window.pywebview.api) {{
                window.pywebview.api.run_automl(target).then(res => {{
                    btn.disabled = false;
                    status.innerText = '';
                    if (res.success) {{
                        document.getElementById('automl-results').style.display = 'block';
                        document.getElementById('automl-best-model').innerText = res.results.best_model;
                        document.getElementById('automl-task').innerText = res.results.task_type.toUpperCase();
                        
                        const mKeys = Object.keys(res.results.metrics);
                        if (mKeys.length > 0) {{
                            document.getElementById('automl-primary-metric').innerText = res.results.metrics[mKeys[0]];
                            document.getElementById('automl-metric-name').innerText = mKeys[0].toUpperCase();
                        }}

                        if (res.results.top_features && res.results.top_features.length > 0) {{
                            const el = document.getElementById('chart-importances');
                            if (featChart) featChart.dispose();
                            featChart = echarts.init(el);
                            const revFeats = [...res.results.top_features].reverse();
                            featChart.setOption({{
                                backgroundColor: 'transparent',
                                tooltip: {{ trigger: 'axis' }},
                                xAxis: {{ type: 'value', splitLine: {{ lineStyle: {{ color: 'rgba(255,255,255,0.06)' }} }}, axisLabel: {{ color: '#94a3b8' }} }},
                                yAxis: {{ type: 'category', data: revFeats.map(f => f.feature), axisLabel: {{ color: '#94a3b8' }} }},
                                series: [{{
                                    type: 'bar',
                                    data: revFeats.map(f => f.importance),
                                    itemStyle: {{ color: '#00f5ff', borderRadius: [0, 4, 4, 0] }}
                                }}]
                            }});
                        }}
                    }} else {{
                        alert('AutoML failed: ' + res.error);
                    }}
                }});
            }}
        }}

        function exportCleanedData() {{
            if (window.pywebview && window.pywebview.api) {{
                window.pywebview.api.export_cleaned_dataset('csv').then(res => {{
                    if (res.success) alert('Cleaned dataset saved to: ' + res.filepath);
                    else alert('Export failed: ' + res.error);
                }});
            }}
        }}

        function exportReport() {{
            if (window.pywebview && window.pywebview.api) {{
                window.pywebview.api.export_report_to_disk().then(res => {{
                    if (res.success) alert('Report exported successfully to: ' + res.filepath);
                    else alert('Export failed: ' + res.error);
                }});
            }}
        }}
    </script>
</body>
</html>
"""


def launch_native_desktop_app(dataset_path: str | None = None) -> int:
    """
    Launches the native offline GTK/WebKit desktop window.
    """
    html_content = build_app_html()
    api = DesktopAppAPI(initial_dataset_path=dataset_path)

    window = webview.create_window(
        title="SnowPulse AI — Autonomous Data Analyst",
        html=html_content,
        js_api=api,
        width=1280,
        height=860,
        min_size=(960, 680),
        background_color="#070b14",
    )
    api.set_window(window)

    webview.start(gui="gtk", debug=False)
    return 0
