"""
SnowPulse AI - Native Offline Desktop Application.
Zero-server, 100% offline desktop application with direct Python-to-GUI bridge,
interactive ECharts visualizations, conversational AI analytics, and AutoML.
"""

import json
import os
from pathlib import Path
from typing import Any
import webview

from .analyzer import NativeDataAnalyzer
from .automl import NativeAutoMLEngine
from .chat import NativeDataChatAgent
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
        self.df: Any = None
        self.analyzer: NativeDataAnalyzer | None = None
        self.chat_agent: NativeDataChatAgent | None = None

        if initial_dataset_path and Path(initial_dataset_path).exists():
            try:
                self._load_internal(initial_dataset_path)
            except Exception:
                pass

    def set_window(self, window: Any):
        self.window = window

    def _load_internal(self, filepath: str) -> dict[str, Any]:
        path = Path(filepath).resolve()
        if not path.exists():
            raise FileNotFoundError(f"File not found: {filepath}")

        self.df = load_dataset(str(path))
        self.dataset_path = str(path)
        dataset_name = path.name

        self.analyzer = NativeDataAnalyzer(self.df, name=dataset_name)
        self.chat_agent = NativeDataChatAgent(self.df, dataset_name=dataset_name)

        summary = self.analyzer.get_summary()
        col_stats = self.analyzer.get_column_stats()
        corrs = self.analyzer.get_top_correlations(top_n=8)
        signals = self.analyzer.get_signals()
        narratives = self.analyzer.generate_narrative()

        # Preview rows (first 15)
        preview_rows = []
        if self.df.height > 0:
            for row in self.df.head(15).iter_rows():
                preview_rows.append([str(v) if v is not None else "" for v in row])

        # Category Chart Data
        cat_labels = []
        cat_values = []
        cat_name = ""
        if self.analyzer.categorical_cols:
            cat_name = self.analyzer.categorical_cols[0]
            top_cats = self.df[cat_name].drop_nulls().value_counts().sort("count", descending=True).head(8)
            cat_labels = [str(r[0]) for r in top_cats.iter_rows()]
            cat_values = [int(r[1]) for r in top_cats.iter_rows()]

        # Numeric Distribution Chart Data
        num_labels = []
        num_values = []
        num_name = ""
        if self.analyzer.numeric_cols:
            num_name = self.analyzer.numeric_cols[0]
            num_series = self.df[num_name].drop_nulls()
            if len(num_series) > 0:
                import numpy as np
                counts, edges = np.histogram(num_series.to_numpy(), bins=10)
                num_labels = [f"{edges[i]:.1f}-{edges[i+1]:.1f}" for i in range(len(counts))]
                num_values = [int(c) for c in counts]

        return {
            "success": True,
            "filename": dataset_name,
            "filepath": str(path),
            "summary": summary,
            "columns": col_stats,
            "numeric_cols": self.analyzer.numeric_cols,
            "categorical_cols": self.analyzer.categorical_cols,
            "preview_columns": self.df.columns,
            "preview_rows": preview_rows,
            "correlations": corrs,
            "signals": signals,
            "narratives": narratives,
            "chart_category": {"title": cat_name, "labels": cat_labels, "values": cat_values},
            "chart_numeric": {"title": num_name, "labels": num_labels, "values": num_values},
        }

    def load_dataset(self, filepath: str) -> dict[str, Any]:
        """Loads a user-specified dataset from disk."""
        try:
            return self._load_internal(filepath)
        except Exception as e:
            return {"success": False, "error": str(e)}

    def load_sample_dataset(self) -> dict[str, Any]:
        """Loads the built-in SaaS churn sample dataset."""
        if SAMPLE_CSV.exists():
            return self.load_dataset(str(SAMPLE_CSV))
        return {"success": False, "error": "Sample dataset not found."}

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
            chosen = selected[0]
            return self.load_dataset(chosen)
        return {"cancelled": True}

    def chat_query(self, question: str) -> dict[str, Any]:
        """Answers natural language data question via Polars AST sandbox."""
        if not self.chat_agent:
            return {"success": False, "error": "No dataset loaded. Please open a dataset first."}

        res = self.chat_agent.query(question)
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
        """Runs AutoML model search, cross-validation, and feature importance."""
        if self.df is None:
            return {"success": False, "error": "No dataset loaded."}

        try:
            automl = NativeAutoMLEngine(self.df, target_col=target_column)
            results = automl.run_training()
            return {"success": True, "results": results}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def export_report_to_disk(self) -> dict[str, Any]:
        """Exports a self-contained interactive HTML report."""
        if self.df is None:
            return {"success": False, "error": "No dataset loaded."}

        try:
            stem = Path(self.dataset_path).stem if self.dataset_path else "dataset"
            out_file = Path.home() / f"{stem}_analytics_report.html"
            generate_html_report(self.df, dataset_name=stem, output_path=out_file)
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
    <title>SnowPulse AI</title>
    <style>
        :root {{
            --bg-dark: #070b14;
            --bg-card: rgba(14, 21, 37, 0.75);
            --bg-card-hover: rgba(22, 32, 54, 0.85);
            --border-dim: rgba(255, 255, 255, 0.08);
            --border-glow: rgba(0, 245, 255, 0.3);
            --accent-cyan: #00f5ff;
            --accent-blue: #38bdf8;
            --accent-purple: #818cf8;
            --text-main: #f8fafc;
            --text-muted: #94a3b8;
            --text-dim: #64748b;
        }}
        * {{ box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }}
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
            background: rgba(10, 15, 28, 0.9);
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
        .brand-title span {{ color: var(--accent-cyan); font-weight: 400; font-size: 14px; margin-left: 6px; }}
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
        nav.tabs {{
            display: flex;
            gap: 6px;
            padding: 10px 24px;
            background: rgba(8, 12, 22, 0.6);
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
        .tab-pane {{ display: none; }}
        .tab-pane.active {{ display: block; }}
        
        /* Empty State */
        .empty-state {{
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 65vh;
            text-align: center;
            border: 2px dashed rgba(255, 255, 255, 0.1);
            border-radius: 16px;
            padding: 40px;
            background: rgba(14, 21, 37, 0.3);
        }}
        .empty-icon {{
            width: 72px;
            height: 72px;
            margin-bottom: 20px;
            color: var(--accent-cyan);
            opacity: 0.8;
        }}
        .empty-title {{ font-size: 22px; font-weight: 700; margin-bottom: 8px; color: #fff; }}
        .empty-desc {{ font-size: 14px; color: var(--text-muted); max-width: 460px; line-height: 1.5; margin-bottom: 24px; }}
        
        /* KPI Grid */
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

        /* AutoML Controls */
        .automl-form {{
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 20px;
        }}
        select {{
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid var(--border-dim);
            color: #fff;
            padding: 9px 16px;
            border-radius: 8px;
            font-size: 14px;
            outline: none;
            min-width: 220px;
        }}
        select option {{ background: #0c1322; color: #fff; }}
        .badge-score {{
            display: inline-block;
            padding: 4px 10px;
            border-radius: 9999px;
            font-weight: 700;
            font-size: 12px;
        }}
        .badge-good {{ background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); }}
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
                <div class="brand-title">SnowPulse AI <span>Autonomous Data Analyst</span></div>
            </div>
        </div>
        <div class="header-actions">
            <button onclick="loadSample()">📁 Open Sample Dataset</button>
            <button class="btn-primary" onclick="openFileDialog()">📂 Browse File...</button>
            <button onclick="exportReport()">📑 Export HTML Report</button>
        </div>
    </header>

    <nav class="tabs">
        <button class="tab-btn active" onclick="switchTab('tab-overview', this)">📊 Dataset Overview</button>
        <button class="tab-btn" onclick="switchTab('tab-chat', this)">💬 Conversational AI</button>
        <button class="tab-btn" onclick="switchTab('tab-automl', this)">⚡ AutoML Predictor</button>
        <button class="tab-btn" onclick="switchTab('tab-preview', this)">📋 Data Table</button>
    </nav>

    <main>
        <!-- Initial Empty State -->
        <div id="empty-state" class="empty-state">
            <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            <div class="empty-title">Welcome to SnowPulse AI</div>
            <div class="empty-desc">
                Your 100% offline, native Ubuntu data analyst. Load any CSV, Parquet, TSV, or SQLite file to get instant statistical profiling, anomaly detection, conversational analytics, and AutoML models.
            </div>
            <div style="display: flex; gap: 12px;">
                <button class="btn-primary" onclick="openFileDialog()">Browse Dataset File</button>
                <button onclick="loadSample()">Load Sample SaaS Analytics</button>
            </div>
        </div>

        <!-- Loaded Content Wrapper -->
        <div id="loaded-content" style="display: none;">
            <!-- Tab 1: Overview -->
            <div id="tab-overview" class="tab-pane active">
                <div class="kpi-row">
                    <div class="kpi-card">
                        <div class="kpi-label">Health Score</div>
                        <div id="kpi-health" class="kpi-value" style="color: var(--accent-cyan);">96.3%</div>
                        <div class="kpi-sub">Cleanliness & Completeness</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-label">Total Records</div>
                        <div id="kpi-rows" class="kpi-value">200</div>
                        <div id="kpi-cols-sub" class="kpi-sub">8 Columns | 0.01 MB</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-label">Missing Cells</div>
                        <div id="kpi-missing" class="kpi-value">14</div>
                        <div class="kpi-sub">Null values detected</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-label">Duplicate Rows</div>
                        <div id="kpi-dups" class="kpi-value">0</div>
                        <div class="kpi-sub">Redundant records</div>
                    </div>
                </div>

                <!-- Executive Narrative -->
                <div class="panel-card">
                    <div class="panel-title">🧠 AI Executive Insights & Narrative</div>
                    <div id="narrative-list" style="display: flex; flex-direction: column; gap: 8px;"></div>
                </div>

                <!-- Charts Row -->
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

                <!-- Schema Summary -->
                <div class="panel-card">
                    <div class="panel-title">📑 Inferred Schema & Attributes</div>
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

            <!-- Tab 2: Conversational AI -->
            <div id="tab-chat" class="tab-pane">
                <div class="chat-container">
                    <div id="chat-messages" class="chat-messages">
                        <div class="chat-msg msg-ai">
                            👋 Hello! I am your native SnowPulse data scientist. Ask me anything about your dataset (e.g. <i>"show top 5 rows"</i>, <i>"average mrr by plan_tier"</i>, <i>"how many rows"</i>).
                        </div>
                    </div>
                    <div class="chat-input-bar">
                        <input id="chat-input" class="chat-input" placeholder="Ask a question about your data..." onkeydown="if(event.key==='Enter') sendChat()" />
                        <button class="btn-primary" onclick="sendChat()">Send ❯</button>
                    </div>
                </div>
            </div>

            <!-- Tab 3: AutoML -->
            <div id="tab-automl" class="tab-pane">
                <div class="panel-card">
                    <div class="panel-title">⚡ Autonomous Machine Learning Trainer</div>
                    <div class="automl-form">
                        <label style="font-size: 13px; font-weight: 600;">Target Column:</label>
                        <select id="automl-target"></select>
                        <button id="btn-run-automl" class="btn-primary" onclick="runAutoML()">Train Best Model</button>
                    </div>
                    <div id="automl-status" style="font-size: 13px; color: var(--text-muted); margin-bottom: 14px;"></div>
                    <div id="automl-results" style="display: none;">
                        <div class="kpi-row" style="margin-top: 16px;">
                            <div class="kpi-card">
                                <div class="kpi-label">Champion Model</div>
                                <div id="automl-best-model" class="kpi-value" style="color: var(--accent-cyan); font-size: 22px;">RandomForest</div>
                                <div id="automl-task" class="kpi-sub">Classification</div>
                            </div>
                            <div class="kpi-card">
                                <div class="kpi-label">Primary Metric</div>
                                <div id="automl-primary-metric" class="kpi-value" style="color: #34d399; font-size: 22px;">1.000</div>
                                <div id="automl-metric-name" class="kpi-sub">Accuracy</div>
                            </div>
                        </div>

                        <div class="panel-card" style="margin-top: 16px;">
                            <div class="panel-title">Top Feature Importances</div>
                            <div id="chart-importances" class="chart-box" style="height: 280px;"></div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Tab 4: Raw Data Preview -->
            <div id="tab-preview" class="tab-pane">
                <div class="panel-card" style="overflow-x: auto;">
                    <div class="panel-title">📋 Dataset Sample Rows (Top 15)</div>
                    <table>
                        <thead id="preview-thead"></thead>
                        <tbody id="preview-tbody"></tbody>
                    </table>
                </div>
            </div>
        </div>
    </main>

    <script>
        let currentDataset = null;
        let catChart = null;
        let numChart = null;
        let featChart = null;

        function switchTab(tabId, btn) {{
            document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('active'));
            document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
            const pane = document.getElementById(tabId);
            if (pane) pane.classList.add('active');
            if (btn) btn.classList.add('active');
            setTimeout(() => {{
                if (catChart) catChart.resize();
                if (numChart) numChart.resize();
                if (featChart) featChart.resize();
            }}, 50);
        }}

        function openFileDialog() {{
            if (window.pywebview && window.pywebview.api) {{
                window.pywebview.api.select_file_dialog().then(renderDataset);
            }}
        }}

        function loadSample() {{
            if (window.pywebview && window.pywebview.api) {{
                window.pywebview.api.load_sample_dataset().then(renderDataset);
            }}
        }}

        function exportReport() {{
            if (window.pywebview && window.pywebview.api) {{
                window.pywebview.api.export_report_to_disk().then(res => {{
                    if (res.success) {{
                        alert('Report exported successfully to: ' + res.filepath);
                    }} else {{
                        alert('Export failed: ' + res.error);
                    }}
                }});
            }}
        }}

        function renderDataset(data) {{
            if (!data || data.cancelled || !data.success) return;
            currentDataset = data;

            document.getElementById('empty-state').style.display = 'none';
            document.getElementById('loaded-content').style.display = 'block';

            // KPIs
            document.getElementById('kpi-health').innerText = data.summary.quality_score + '%';
            document.getElementById('kpi-rows').innerText = data.summary.rows.toLocaleString();
            document.getElementById('kpi-cols-sub').innerText = data.summary.columns + ' Columns | ' + data.summary.memory_mb + ' MB';
            document.getElementById('kpi-missing').innerText = data.summary.total_missing.toLocaleString();
            document.getElementById('kpi-dups').innerText = data.summary.duplicate_rows.toLocaleString();

            // Narratives
            const nList = document.getElementById('narrative-list');
            nList.innerHTML = '';
            data.narratives.forEach(n => {{
                const d = document.createElement('div');
                d.style.padding = '8px 12px';
                d.style.background = 'rgba(255,255,255,0.02)';
                d.style.borderLeft = '3px solid var(--accent-cyan)';
                d.style.borderRadius = '6px';
                d.style.fontSize = '13px';
                d.innerHTML = n.replace(/\\*\\*(.*?)\\*\\*/g, '<b>$1</b>').replace(/`(.*?)`/g, '<code style="color:var(--accent-cyan);">$1</code>');
                nList.appendChild(d);
            }});

            // Schema Table
            const sBody = document.getElementById('schema-tbody');
            sBody.innerHTML = '';
            data.columns.forEach(c => {{
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
            data.columns.forEach(c => {{
                const opt = document.createElement('option');
                opt.value = c.name;
                opt.innerText = c.name + ' (' + c.role + ')';
                autoSelect.appendChild(opt);
            }});

            // Preview Table
            const pHead = document.getElementById('preview-thead');
            pHead.innerHTML = '<tr>' + data.preview_columns.map(col => '<th>' + col + '</th>').join('') + '</tr>';
            const pBody = document.getElementById('preview-tbody');
            pBody.innerHTML = '';
            data.preview_rows.forEach(r => {{
                pBody.innerHTML += '<tr>' + r.map(v => '<td>' + v + '</td>').join('') + '</tr>';
            }});

            // Render Charts
            renderCharts(data);
        }}

        function renderCharts(data) {{
            if (typeof echarts === 'undefined') return;

            // Category Chart
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

            // Numeric Distribution Chart
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
            status.innerText = 'Training candidate models with cross-validation...';

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

                        // Feature importance chart
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

        window.addEventListener('pywebviewready', () => {{
            // Auto-load sample if ready and no dataset yet
            loadSample();
        }});
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

    icon_path = str(PROJECT_ROOT / "favicon.svg")
    png_icon = Path.home() / ".local" / "share" / "icons" / "snowpulse.png"
    if png_icon.exists():
        icon_path = str(png_icon)

    window = webview.create_window(
        title="SnowPulse AI — Autonomous Data Analyst",
        html=html_content,
        js_api=api,
        width=1240,
        height=840,
        min_size=(920, 640),
        background_color="#070b14",
    )
    api.set_window(window)

    # Start native GTK event loop
    webview.start(gui="gtk", debug=False)
    return 0
