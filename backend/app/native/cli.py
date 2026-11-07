"""
SnowPulse AI - Native Ubuntu Command Line Interface.
The definitive AI Data Analyst tool for Ubuntu Linux.
"""

import argparse
import os
import sys
import warnings
import webbrowser
from pathlib import Path

warnings.filterwarnings("ignore", category=FutureWarning)

from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.text import Text
from rich.prompt import Prompt

from .desktop import install_desktop_integration, send_desktop_notification
from .loader import load_dataset
from .analyzer import NativeDataAnalyzer
from .chat import NativeDataChatAgent
from .report import generate_html_report
from .automl import NativeAutoMLEngine

console = Console()

BANNER = r"""
[bold cyan]   _____                    _____        _              ___    _____ [/bold cyan]
[bold cyan]  / ____|                  |  __ \      | |            / _ \  |_   _|[/bold cyan]
[bold cyan] | (___  _ __   _____      _| |__) |   _| |___  ___   / /_\ \   | |  [/bold cyan]
[bold cyan]  \___ \| '_ \ / _ \ \ /\ / /  ___/ | | | / __|/ _ \  |  _  |   | |  [/bold cyan]
[bold cyan]  ____) | | | | (_) \ V  V /| |   | |_| | \__ \  __/  | | | |  _| |_ [/bold cyan]
[bold cyan] |_____/|_| |_|\___/ \_/\_/ |_|    \__,_|_|___/\___|  |_| |_| |_____|[/bold cyan]
[bold white]  Ubuntu Native Enterprise AI Data Analyst & Analytics Operating System[/bold white]
"""


def cmd_analyze(args):
    """Analyze a dataset and display comprehensive EDA in the terminal."""
    console.print(f"[bold cyan]Loading dataset:[/bold cyan] {args.dataset}")
    try:
        df = load_dataset(args.dataset)
    except Exception as e:
        console.print(f"[bold red]Error loading dataset:[/bold red] {e}")
        return 1

    dataset_name = Path(args.dataset).name
    analyzer = NativeDataAnalyzer(df, name=dataset_name)
    summary = analyzer.get_summary()

    # Summary Panel
    summary_text = (
        f"[bold white]Records:[/bold white] {summary['rows']:,} rows × {summary['columns']} columns\n"
        f"[bold white]Memory Footprint:[/bold white] {summary['memory_mb']} MB\n"
        f"[bold white]Attributes:[/bold white] {summary['numeric_count']} numeric, {summary['categorical_count']} categorical, {summary['temporal_count']} temporal\n"
        f"[bold white]Cleanliness:[/bold white] {summary['quality_score']}% health ({summary['total_missing']:,} nulls, {summary['duplicate_rows']:,} duplicates)"
    )
    console.print(Panel(summary_text, title=f"[bold green]📊 Dataset Health: {dataset_name}[/bold green]", border_style="cyan"))

    # Column Stats Table
    stats = analyzer.get_column_stats()
    table = Table(title="Column Schema & Statistical Distributions", border_style="dim")
    table.add_column("Column", style="bold white")
    table.add_column("Role", style="cyan")
    table.add_column("Type", style="magenta")
    table.add_column("Missing %", justify="right")
    table.add_column("Summary / Stats", style="yellow")

    for col in stats:
        missing_color = "green" if col["missing_pct"] == 0 else ("yellow" if col["missing_pct"] < 10 else "red")
        details = col.get("top_values") or f"mean: {col.get('mean', 'N/A')} | min: {col.get('min', 'N/A')} | max: {col.get('max', 'N/A')}"
        table.add_row(
            col["name"],
            col["role"],
            col["dtype"],
            f"[{missing_color}]{col['missing_pct']}%[/{missing_color}]",
            details,
        )
    console.print(table)

    # Top Correlations Table
    corrs = analyzer.get_top_correlations(top_n=6)
    if corrs:
        c_table = Table(title="Key Drivers & Statistical Correlations (|r| >= 0.5)", border_style="dim")
        c_table.add_column("Metric A", style="bold white")
        c_table.add_column("Metric B", style="bold white")
        c_table.add_column("Pearson r", justify="right", style="bold cyan")
        c_table.add_column("Strength", style="green")

        for c in corrs:
            c_table.add_row(c["col_a"], c["col_b"], str(c["r"]), c["relationship"])
        console.print(c_table)

    # Signals
    signals = analyzer.get_signals()
    if signals:
        s_table = Table(title="Autonomous Statistical Signals & Anomalies", border_style="dim")
        s_table.add_column("Signal Type", style="cyan")
        s_table.add_column("Anomaly Alert", style="bold yellow")
        s_table.add_column("Description", style="white")

        for s in signals[:5]:
            s_table.add_row(s["type"], s["title"], s["description"])
        console.print(s_table)

    # AI Executive Narrative
    narratives = analyzer.generate_narrative()
    narrative_text = "\n\n".join(f"• {n}" for n in narratives)
    console.print(Panel(narrative_text, title="[bold purple]🧠 AI Executive Narrative & Drivers[/bold purple]", border_style="purple"))

    # Desktop Notification
    send_desktop_notification(
        "SnowPulse Analysis Complete",
        f"{dataset_name}: {summary['rows']:,} rows profiled. Health: {summary['quality_score']}%"
    )

    if args.report:
        report_path = args.report if isinstance(args.report, str) and args.report != "True" else f"{Path(args.dataset).stem}_report.html"
        generate_html_report(df, dataset_name=dataset_name, output_path=report_path)
        console.print(f"[bold green]✓ Interactive HTML report generated:[/bold green] {report_path}")
        if args.open:
            webbrowser.open(f"file://{Path(report_path).resolve()}")

    return 0


def cmd_chat(args):
    """Launch interactive conversational AI data scientist session in terminal."""
    console.print(BANNER)
    console.print(f"[bold cyan]Loading dataset for chat:[/bold cyan] {args.dataset}")
    try:
        df = load_dataset(args.dataset)
    except Exception as e:
        console.print(f"[bold red]Error loading dataset:[/bold red] {e}")
        return 1

    dataset_name = Path(args.dataset).name
    chat_agent = NativeDataChatAgent(df, dataset_name=dataset_name)

    mode_info = "[bold green]Gemini AI Mode Enabled[/bold green]" if chat_agent.has_llm else "[bold yellow]Offline Native Heuristic Mode Active (Set GEMINI_API_KEY for full LLM power)[/bold yellow]"
    console.print(f"[dim]Dataset:[/dim] [bold white]{dataset_name}[/bold white] ({df.height:,} rows, {df.width} cols) | {mode_info}")

    # Single-shot query mode
    single_query = getattr(args, "query", None)
    if single_query:
        with console.status("[bold cyan]Analyzing dataset & synthesizing Polars expressions...[/bold cyan]"):
            res = chat_agent.query(single_query)

        if not res.get("success"):
            console.print(f"[bold red]Query failed:[/bold red] {res.get('error')}")
            if res.get("code"):
                console.print(f"[dim]Generated code: {res.get('code')}[/dim]")
            return 1

        res_df = res.get("result_df")
        if res_df is not None and res_df.height > 0:
            table = Table(border_style="cyan", show_header=True)
            for col_name in res_df.columns:
                table.add_column(str(col_name), style="white")

            for row in res_df.head(20).iter_rows():
                table.add_row(*[str(val) for val in row])
            console.print(table)
            if res_df.height > 20:
                console.print(f"[dim]Showing top 20 of {res_df.height} rows[/dim]")

        if res.get("narrative"):
            console.print(f"[bold white]{res.get('narrative')}[/bold white]")
        console.print(f"[dim]⚡ Polars: {res.get('code')}[/dim]\n")
        return 0

    console.print("[dim]Type your natural language data questions below. Type 'exit' or 'quit' to end.[/dim]\n")

    while True:
        try:
            query = Prompt.ask("[bold cyan]SnowPulse AI ❯[/bold cyan]")
            if not query or query.lower().strip() in ("exit", "quit", "q"):
                console.print("[dim]Session ended.[/dim]")
                break

            with console.status("[bold cyan]Analyzing dataset & synthesizing Polars expressions...[/bold cyan]"):
                res = chat_agent.query(query)

            if not res.get("success"):
                console.print(f"[bold red]Query failed:[/bold red] {res.get('error')}")
                if res.get("code"):
                    console.print(f"[dim]Generated code: {res.get('code')}[/dim]")
                continue

            # Display result table
            res_df = res.get("result_df")
            if res_df is not None and res_df.height > 0:
                table = Table(border_style="cyan", show_header=True)
                for col_name in res_df.columns:
                    table.add_column(str(col_name), style="white")

                for row in res_df.head(15).iter_rows():
                    table.add_row(*[str(val) for val in row])
                console.print(table)
                if res_df.height > 15:
                    console.print(f"[dim]Showing top 15 of {res_df.height} rows[/dim]")

            # Display narrative
            if res.get("narrative"):
                console.print(f"[bold white]{res.get('narrative')}[/bold white]")
            console.print(f"[dim]⚡ Polars: {res.get('code')}[/dim]\n")

        except (KeyboardInterrupt, EOFError):
            console.print("\n[dim]Session closed.[/dim]")
            break
    return 0


def cmd_report(args):
    """Generate standalone interactive HTML report."""
    console.print(f"[bold cyan]Generating interactive report for:[/bold cyan] {args.dataset}")
    try:
        df = load_dataset(args.dataset)
    except Exception as e:
        console.print(f"[bold red]Error loading dataset:[/bold red] {e}")
        return 1

    dataset_name = Path(args.dataset).name
    out_path = args.output or f"{Path(args.dataset).stem}_report.html"
    generate_html_report(df, dataset_name=dataset_name, output_path=out_path)
    abs_path = Path(out_path).resolve()
    console.print(f"[bold green]✓ Standalone HTML Report ready:[/bold green] {abs_path}")

    send_desktop_notification("Report Generated", f"SnowPulse report saved to {out_path}")

    if args.open or getattr(args, "show", False):
        webbrowser.open(f"file://{abs_path}")
    return 0


def cmd_predict(args):
    """Run AutoML model training (classification or regression) with feature importance."""
    console.print(f"[bold cyan]Running AutoML on dataset:[/bold cyan] {args.dataset} [bold cyan]Target:[/bold cyan] {args.target}")
    try:
        df = load_dataset(args.dataset)
    except Exception as e:
        console.print(f"[bold red]Error loading dataset:[/bold red] {e}")
        return 1

    try:
        with console.status("[bold cyan]Training candidate models with cross-validation...[/bold cyan]"):
            automl = NativeAutoMLEngine(df, target_col=args.target)
            results = automl.run_training()
    except Exception as e:
        console.print(f"[bold red]AutoML training failed:[/bold red] {e}")
        return 1

    # Results Table
    console.print(Panel(
        f"[bold white]Task Type:[/bold white] {results['task_type'].title()}\n"
        f"[bold white]Best Model Architecture:[/bold white] [bold green]{results['best_model']}[/bold green]\n"
        f"[bold white]Evaluated Samples:[/bold white] {results['sample_count']:,}\n"
        f"[bold white]Metrics:[/bold white] " + ", ".join(f"{k}: {v}" for k, v in results['metrics'].items()),
        title=f"[bold green]🏆 AutoML Champion: {results['best_model']}[/bold green]",
        border_style="green"
    ))

    # Feature importances
    if results.get("top_features"):
        table = Table(title="Top 10 Feature Importances", border_style="dim")
        table.add_column("Rank", justify="right")
        table.add_column("Feature", style="bold white")
        table.add_column("Relative Importance", style="bold cyan")

        for idx, feat in enumerate(results["top_features"], 1):
            bar = "█" * int(feat["importance"] * 30)
            table.add_row(str(idx), feat["feature"], f"{feat['importance']:.4f}  {bar}")
        console.print(table)

    send_desktop_notification("AutoML Complete", f"Best model: {results['best_model']} for target {args.target}")
    return 0


def cmd_doctor(args):
    """Diagnose system health, libraries, storage, and desktop integration."""
    console.print(BANNER)
    console.print("[bold cyan]Running SnowPulse AI System Diagnostics...[/bold cyan]\n")

    table = Table(title="System & Runtime Status", border_style="dim")
    table.add_column("Component", style="bold white")
    table.add_column("Status", style="bold")
    table.add_column("Details", style="dim")

    # Python version
    py_ver = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
    table.add_row("Python Runtime", "[green]✓ OK[/green]", f"Python {py_ver}")

    # Core packages
    for pkg in ["polars", "pandas", "numpy", "scipy", "sklearn", "fastapi", "sqlalchemy"]:
        try:
            __import__(pkg)
            table.add_row(f"Library: {pkg}", "[green]✓ Installed[/green]", "Native support ready")
        except ImportError:
            table.add_row(f"Library: {pkg}", "[red]✗ Missing[/red]", "Run pip install")

    # Desktop launcher check
    launcher = Path.home() / ".local/share/applications/snowpulse.desktop"
    if launcher.exists():
        table.add_row("Ubuntu Desktop Entry", "[green]✓ Installed[/green]", str(launcher))
    else:
        table.add_row("Ubuntu Desktop Entry", "[yellow]! Not installed[/yellow]", "Run 'snowpulse install-desktop'")

    # WhiteSur Icon
    icon = Path.home() / ".local/share/icons/WhiteSur/apps/scalable/snowpulse.svg"
    if icon.exists():
        table.add_row("WhiteSur Icon", "[green]✓ Installed[/green]", str(icon))
    else:
        table.add_row("WhiteSur Icon", "[yellow]! Missing[/yellow]", "Run 'snowpulse install-desktop'")

    # Gemini API Key
    key = os.getenv("GEMINI_API_KEY")
    if key and not key.startswith("mock-"):
        table.add_row("Gemini AI API Key", "[green]✓ Configured[/green]", f"{key[:8]}...{key[-4:]}")
    else:
        table.add_row("Gemini AI API Key", "[yellow]! Offline Heuristic[/yellow]", "Set GEMINI_API_KEY in ~/.bashrc or .env")

    console.print(table)
    return 0


def cmd_install_desktop(args):
    """Installs Ubuntu desktop launcher, WhiteSur icons, and CLI."""
    console.print("[bold cyan]Installing SnowPulse AI Ubuntu Desktop Integration...[/bold cyan]")
    res = install_desktop_integration()
    for k, v in res.items():
        console.print(f"  [green]✓[/green] {k}: {v}")
    console.print("\n[bold green]✓ SnowPulse AI is now natively integrated with Ubuntu Dash and Applications menu![/bold green]")
    return 0


def cmd_serve(args):
    """Starts the native FastAPI backend server."""
    port = getattr(args, "port", 8000) or 8000
    host = getattr(args, "host", "127.0.0.1") or "127.0.0.1"

    console.print(BANNER)
    console.print(f"[bold cyan]Launching SnowPulse AI Native Server at http://{host}:{port}[/bold cyan]")
    send_desktop_notification("SnowPulse AI Server", f"Running at http://{host}:{port}")

    if not getattr(args, "no_browser", False):
        webbrowser.open(f"http://{host}:{port}/docs")

    import uvicorn
    uvicorn.run("app.main:app", host=host, port=port, reload=False)
    return 0


def cmd_app(args):
    """Launches the 100% offline native GTK desktop application."""
    dataset_path = getattr(args, "dataset", None)
    try:
        from .gui import launch_native_desktop_app
        return launch_native_desktop_app(dataset_path)
    except Exception as e:
        console.print(f"[bold yellow]Native GTK window initialization notice:[/bold yellow] {e}")
        console.print("[dim]Falling back to offline standalone report interface...[/dim]")
        target = dataset_path or str(Path(__file__).resolve().parent.parent.parent / "local_storage" / "datasets" / "saas_customer_churn_analytics.csv")
        args.dataset = target
        args.report = True
        args.open = True
        return cmd_analyze(args)


def main():
    parser = argparse.ArgumentParser(description="SnowPulse AI - Ubuntu Native AI Data Analysis OS")
    subparsers = parser.add_subparsers(dest="command", help="Available subcommands")

    # analyze
    p_analyze = subparsers.add_parser("analyze", help="Profile and analyze a dataset")
    p_analyze.add_argument("dataset", help="Path to CSV, TSV, Parquet, JSON, Excel, or SQLite file")
    p_analyze.add_argument("-r", "--report", nargs="?", const=True, default=False, help="Generate interactive HTML report")
    p_analyze.add_argument("--open", action="store_true", help="Open generated report in browser")

    # chat
    p_chat = subparsers.add_parser("chat", help="Interactive conversational AI data analyst session")
    p_chat.add_argument("dataset", help="Path to dataset to converse with")
    p_chat.add_argument("-q", "--query", help="Single query to execute without entering interactive REPL")

    # report
    p_report = subparsers.add_parser("report", help="Generate interactive standalone HTML report")
    p_report.add_argument("dataset", help="Path to dataset")
    p_report.add_argument("-o", "--output", help="Output file path (default: <name>_report.html)")
    p_report.add_argument("--open", action="store_true", help="Open in web browser immediately")

    # predict
    p_predict = subparsers.add_parser("predict", help="Run AutoML model training and feature importance")
    p_predict.add_argument("dataset", help="Path to dataset")
    p_predict.add_argument("-t", "--target", required=True, help="Target column to predict")

    # doctor
    subparsers.add_parser("doctor", help="Check system dependencies and integration status")

    # install-desktop
    subparsers.add_parser("install-desktop", help="Install Ubuntu application launcher and WhiteSur icons")

    # serve / start / app
    p_serve = subparsers.add_parser("serve", help="Launch native SnowPulse server")
    p_serve.add_argument("--host", default="127.0.0.1", help="Host to bind to")
    p_serve.add_argument("-p", "--port", type=int, default=8000, help="Port to bind to")
    p_serve.add_argument("--no-browser", action="store_true", help="Do not open browser")

    p_app = subparsers.add_parser("app", help="Launch desktop app UI")
    p_app.add_argument("dataset", nargs="?", help="Optional dataset file to open")

    args = parser.parse_args()

    if not args.command:
        console.print(BANNER)
        parser.print_help()
        return 0

    if args.command == "analyze":
        return cmd_analyze(args)
    elif args.command == "chat":
        return cmd_chat(args)
    elif args.command == "report":
        return cmd_report(args)
    elif args.command == "predict":
        return cmd_predict(args)
    elif args.command == "doctor":
        return cmd_doctor(args)
    elif args.command == "install-desktop":
        return cmd_install_desktop(args)
    elif args.command == "serve":
        return cmd_serve(args)
    elif args.command == "app":
        return cmd_app(args)

    return 0


if __name__ == "__main__":
    sys.exit(main())
