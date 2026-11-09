"""
SnowPulse AI - Standalone Interactive HTML Report Generator.
Generates self-contained, enterprise-grade dark glassmorphic HTML reports
with embedded interactive ECharts, KPI meters, and AI narratives.
"""

import json
from pathlib import Path
from typing import Any

import polars as pl

from .analyzer import NativeDataAnalyzer


def generate_html_report(
    df: pl.DataFrame,
    dataset_name: str = "Dataset",
    output_path: str | Path | None = None,
    cleaning_report: dict[str, Any] | None = None,
) -> str:
    """
    Generates a standalone interactive HTML report from a dataset.
    """
    analyzer = NativeDataAnalyzer(df, name=dataset_name)
    summary = analyzer.get_summary()
    col_stats = analyzer.get_column_stats()
    corrs = analyzer.get_top_correlations(top_n=8)
    signals = analyzer.get_signals()
    narratives = analyzer.generate_narrative()

    # Prepare offline ECharts runtime
    echarts_file = Path(__file__).resolve().parent / "static" / "echarts.min.js"
    if echarts_file.exists():
        echarts_script = f"<script>{echarts_file.read_text(encoding='utf-8')}</script>"
    else:
        echarts_script = '<script src="https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js"></script>'

    # Smart selection of primary business dimension and metric (filters out IDs)
    candidates = analyzer.get_smart_chart_candidates()
    best_dim = candidates["primary_dimension"]
    best_metric = candidates["primary_metric"]

    # Category chart data (smart meaningful dimension, NOT identifier)
    cat_chart_labels = []
    cat_chart_values = []
    cat_title = "Categorical Distribution"
    if best_dim and best_dim in df.columns:
        cat_title = f"{best_dim} Breakdown"
        top_cats = df[best_dim].drop_nulls().value_counts().sort("count", descending=True).head(8)
        cat_chart_labels = [str(r[0]) for r in top_cats.iter_rows()]
        cat_chart_values = [int(r[1]) for r in top_cats.iter_rows()]

    # Numeric distribution data (primary continuous metric)
    num_chart_labels = []
    num_chart_values = []
    num_title = "Numeric Distribution"
    if best_metric and best_metric in df.columns:
        num_title = f"{best_metric} Distribution"
        num_series = df[best_metric].drop_nulls()
        if len(num_series) > 0:
            import numpy as np
            counts, edges = np.histogram(num_series.to_numpy(), bins=10)
            num_chart_labels = [f"{edges[i]:.1f}-{edges[i+1]:.1f}" for i in range(len(counts))]
            num_chart_values = [int(c) for c in counts]

    # Pre-render table and list sections
    narratives_html = "".join(f'<div class="narrative-item">{n}</div>' for n in narratives)

    cleaning_html = ""
    if cleaning_report:
        trans_items = "".join(
            f'<div class="narrative-item" style="border-left-color: #34d399;">✓ {t}</div>'
            for t in cleaning_report.get("transformations", [])
        )
        cleaning_html = f"""
        <!-- Data Preprocessing & Cleaning Audit -->
        <div class="section-card">
            <div class="section-title" style="color: #34d399;">✨ Data Preprocessing & Quality Audit</div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; margin-bottom: 16px;">
                <div style="background: rgba(255,255,255,0.03); padding: 12px; border-radius: 8px;">
                    <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase;">Health Score Gain</div>
                    <div style="font-size: 20px; font-weight: 700; color: #34d399;">{cleaning_report.get('initial_health_score', 0)}% ➔ {cleaning_report.get('final_health_score', 0)}%</div>
                </div>
                <div style="background: rgba(255,255,255,0.03); padding: 12px; border-radius: 8px;">
                    <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase;">Missing Cells Resolved</div>
                    <div style="font-size: 20px; font-weight: 700; color: #fff;">{cleaning_report.get('missing_resolved', 0):,}</div>
                </div>
                <div style="background: rgba(255,255,255,0.03); padding: 12px; border-radius: 8px;">
                    <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase;">Duplicates Removed</div>
                    <div style="font-size: 20px; font-weight: 700; color: #fff;">{cleaning_report.get('duplicates_removed', 0):,}</div>
                </div>
            </div>
            {trans_items}
        </div>
        """

    if corrs:
        corrs_html = "".join(
            f'<tr><td><b>{c["col_a"]}</b></td><td><b>{c["col_b"]}</b></td><td>{c["r"]}</td><td><span class="badge">{c["relationship"]}</span></td></tr>'
            for c in corrs
        )
    else:
        corrs_html = '<tr><td colspan="4">No significant correlations detected.</td></tr>'

    if signals:
        signals_html = "".join(
            f'<tr><td><span class="tag tag-metric">{s["type"]}</span></td><td><b>{s["title"]}</b></td><td>{s["description"]}</td><td>{s["severity"]:.2f}</td></tr>'
            for s in signals
        )
    else:
        signals_html = '<tr><td colspan="4">No critical anomalies detected in dataset.</td></tr>'

    rows_list = []
    for c in col_stats:
        name = c["name"]
        role = c["role"]
        dtype = c["dtype"]
        missing = c["missing_pct"]
        if c.get("top_values"):
            detail = c["top_values"]
        else:
            detail = f"mean: {c.get('mean', 'N/A')} | min: {c.get('min', 'N/A')} | max: {c.get('max', 'N/A')}"
        rows_list.append(f'<tr><td><b>{name}</b></td><td><span class="tag tag-cat">{role}</span></td><td>{dtype}</td><td>{missing}%</td><td>{detail}</td></tr>')
    schema_rows_html = "".join(rows_list)

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SnowPulse AI - {dataset_name} Analytics Report</title>
    {echarts_script}
    <style>
        :root {{
            --bg: #090b10;
            --card-bg: rgba(22, 27, 39, 0.7);
            --card-border: rgba(255, 255, 255, 0.08);
            --accent-cyan: #06b6d4;
            --accent-blue: #3b82f6;
            --text-primary: #f8fafc;
            --text-secondary: #94a3b8;
            --text-muted: #64748b;
        }}
        * {{ box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }}
        body {{
            background: var(--bg);
            color: var(--text-primary);
            padding: 32px 24px;
            background-image: radial-gradient(circle at 15% 15%, rgba(6, 182, 212, 0.12) 0%, transparent 40%),
                              radial-gradient(circle at 85% 85%, rgba(59, 130, 246, 0.12) 0%, transparent 40%);
            background-attachment: fixed;
            min-height: 100vh;
        }}
        .container {{ max-width: 1200px; margin: 0 auto; }}
        header {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid var(--card-border);
            padding-bottom: 24px;
            margin-bottom: 32px;
        }}
        .logo {{ display: flex; align-items: center; gap: 14px; }}
        .badge {{
            padding: 4px 12px;
            border-radius: 9999px;
            font-size: 12px;
            font-weight: 600;
            background: rgba(6, 182, 212, 0.15);
            color: var(--accent-cyan);
            border: 1px solid rgba(6, 182, 212, 0.3);
        }}
        .kpi-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 18px;
            margin-bottom: 32px;
        }}
        .kpi-card {{
            background: var(--card-bg);
            border: 1px solid var(--card-border);
            border-radius: 16px;
            padding: 20px;
            backdrop-filter: blur(12px);
        }}
        .kpi-title {{ font-size: 12px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px; }}
        .kpi-val {{ font-size: 30px; font-weight: 700; color: #fff; }}
        .kpi-sub {{ font-size: 12px; color: var(--text-secondary); margin-top: 4px; }}

        .section-card {{
            background: var(--card-bg);
            border: 1px solid var(--card-border);
            border-radius: 18px;
            padding: 24px;
            margin-bottom: 28px;
            backdrop-filter: blur(12px);
        }}
        .section-title {{ font-size: 18px; font-weight: 700; margin-bottom: 16px; display: flex; align-items: center; gap: 10px; }}

        .charts-row {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
            gap: 20px;
            margin-bottom: 28px;
        }}
        .chart-box {{ width: 100%; height: 320px; }}

        table {{
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
        }}
        th {{
            text-align: left;
            padding: 12px 14px;
            color: var(--text-muted);
            border-bottom: 1px solid var(--card-border);
            text-transform: uppercase;
            font-size: 11px;
            letter-spacing: 0.05em;
        }}
        td {{
            padding: 12px 14px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.04);
            color: var(--text-secondary);
        }}
        tr:hover td {{ background: rgba(255, 255, 255, 0.02); color: #fff; }}

        .narrative-item {{
            padding: 12px 16px;
            background: rgba(255, 255, 255, 0.03);
            border-left: 3px solid var(--accent-cyan);
            border-radius: 8px;
            margin-bottom: 10px;
            font-size: 14px;
            line-height: 1.5;
        }}
        .tag {{
            display: inline-block;
            padding: 2px 8px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 600;
        }}
        .tag-metric {{ background: rgba(59, 130, 246, 0.2); color: #60a5fa; }}
        .tag-cat {{ background: rgba(168, 85, 247, 0.2); color: #c084fc; }}
        .tag-time {{ background: rgba(234, 179, 8, 0.2); color: #fde047; }}
    </style>
</head>
<body>
    <div class="container">
        <header>
            <div class="logo">
                <svg width="36" height="36" viewBox="0 0 100 100" fill="none">
                    <rect x="4" y="4" width="92" height="92" rx="24" fill="#06b6d4" fill-opacity="0.2" stroke="#06b6d4" stroke-width="2"/>
                    <path d="M50,20 L50,80 M20,50 L80,50 M30,30 L70,70 M30,70 L70,30" stroke="#06b6d4" stroke-width="8" stroke-linecap="round"/>
                </svg>
                <div>
                    <h1 style="font-size: 22px; font-weight: 800; letter-spacing: -0.02em;">SnowPulse AI <span style="font-weight: 400; color: var(--text-secondary);">Enterprise Report</span></h1>
                    <p style="font-size: 12px; color: var(--text-muted);">{dataset_name}</p>
                </div>
            </div>
            <div>
                <span class="badge">Autonomous Intelligence</span>
            </div>
        </header>

        <!-- KPI Grid -->
        <div class="kpi-grid">
            <div class="kpi-card">
                <div class="kpi-title">Data Health Score</div>
                <div class="kpi-val" style="color: var(--accent-cyan);">{summary['quality_score']}%</div>
                <div class="kpi-sub">Completeness & Uniqueness</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-title">Total Records</div>
                <div class="kpi-val">{summary['rows']:,}</div>
                <div class="kpi-sub">{summary['columns']} Attributes | {summary['memory_mb']} MB</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-title">Missing Values</div>
                <div class="kpi-val">{summary['total_missing']:,}</div>
                <div class="kpi-sub">Total null cells detected</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-title">Duplicate Rows</div>
                <div class="kpi-val">{summary['duplicate_rows']:,}</div>
                <div class="kpi-sub">Redundant row instances</div>
            </div>
        </div>

        {cleaning_html}

        <!-- AI Executive Narrative -->
        <div class="section-card">
            <div class="section-title">🧠 AI Executive Insights & Narrative</div>
            {narratives_html}
        </div>

        <!-- Visual Analytics Row -->
        <div class="charts-row">
            <div class="section-card">
                <div class="section-title">📊 {cat_title}</div>
                <div id="catChart" class="chart-box"></div>
            </div>
            <div class="section-card">
                <div class="section-title">📈 {num_title}</div>
                <div id="numChart" class="chart-box"></div>
            </div>
        </div>

        <!-- Correlations -->
        <div class="section-card">
            <div class="section-title">🔗 Key Driver & Correlation Analysis</div>
            <table>
                <thead>
                    <tr>
                        <th>Metric A</th>
                        <th>Metric B</th>
                        <th>Correlation (r)</th>
                        <th>Relationship Strength</th>
                    </tr>
                </thead>
                <tbody>
                    {corrs_html}
                </tbody>
            </table>
        </div>

        <!-- Detected Signals & Anomalies -->
        <div class="section-card">
            <div class="section-title">⚡ Autonomous Statistical Signals & Anomalies</div>
            <table>
                <thead>
                    <tr>
                        <th>Signal Type</th>
                        <th>Title</th>
                        <th>Description</th>
                        <th>Impact Severity</th>
                    </tr>
                </thead>
                <tbody>
                    {signals_html}
                </tbody>
            </table>
        </div>

        <!-- Schema Overview -->
        <div class="section-card">
            <div class="section-title">📑 Comprehensive Schema Profile</div>
            <table>
                <thead>
                    <tr>
                        <th>Column Name</th>
                        <th>Role</th>
                        <th>Type</th>
                        <th>Missing %</th>
                        <th>Details / Stats</th>
                    </tr>
                </thead>
                <tbody>
                    {schema_rows_html}
                </tbody>
            </table>
        </div>
    </div>

    <script>
        // Category Chart
        const catChartEl = document.getElementById('catChart');
        if (catChartEl) {{
            const catChart = echarts.init(catChartEl);
            catChart.setOption({{
                backgroundColor: 'transparent',
                tooltip: {{ trigger: 'axis' }},
                xAxis: {{
                    type: 'category',
                    data: {json.dumps(cat_chart_labels)},
                    axisLabel: {{ color: '#94a3b8', rotate: 20 }}
                }},
                yAxis: {{
                    type: 'value',
                    splitLine: {{ lineStyle: {{ color: 'rgba(255,255,255,0.06)' }} }},
                    axisLabel: {{ color: '#94a3b8' }}
                }},
                series: [{{
                    data: {json.dumps(cat_chart_values)},
                    type: 'bar',
                    itemStyle: {{
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            {{ offset: 0, color: '#06b6d4' }},
                            {{ offset: 1, color: '#3b82f6' }}
                        ]),
                        borderRadius: [6, 6, 0, 0]
                    }}
                }}]
            }});
        }}

        // Numeric Distribution Chart
        const numChartEl = document.getElementById('numChart');
        if (numChartEl) {{
            const numChart = echarts.init(numChartEl);
            numChart.setOption({{
                backgroundColor: 'transparent',
                tooltip: {{ trigger: 'axis' }},
                xAxis: {{
                    type: 'category',
                    data: {json.dumps(num_chart_labels)},
                    axisLabel: {{ color: '#94a3b8', rotate: 25 }}
                }},
                yAxis: {{
                    type: 'value',
                    splitLine: {{ lineStyle: {{ color: 'rgba(255,255,255,0.06)' }} }},
                    axisLabel: {{ color: '#94a3b8' }}
                }},
                series: [{{
                    data: {json.dumps(num_chart_values)},
                    type: 'line',
                    smooth: true,
                    areaStyle: {{
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            {{ offset: 0, color: 'rgba(6, 182, 212, 0.4)' }},
                            {{ offset: 1, color: 'rgba(6, 182, 212, 0.0)' }}
                        ])
                    }},
                    itemStyle: {{ color: '#06b6d4' }},
                    lineStyle: {{ width: 3 }}
                }}]
            }});
        }}

        window.addEventListener('resize', () => {{
            echarts.getInstanceByDom(document.getElementById('catChart'))?.resize();
            echarts.getInstanceByDom(document.getElementById('numChart'))?.resize();
        }});
    </script>
</body>
</html>
"""

    if output_path:
        out_file = Path(output_path).resolve()
        out_file.parent.mkdir(parents=True, exist_ok=True)
        out_file.write_text(html_content, encoding="utf-8")

    return html_content
