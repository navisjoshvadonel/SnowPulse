"""
SnowPulse AI - Ubuntu Native Desktop Integration.
Configures GNOME / WhiteSur desktop entries, MIME associations, icons, and native notifications.
"""

import os
import shutil
import subprocess
from pathlib import Path


def get_project_root() -> Path:
    return Path(__file__).resolve().parent.parent.parent.parent


def send_desktop_notification(title: str, message: str, urgency: str = "normal") -> bool:
    """
    Sends a native Ubuntu desktop notification via notify-send.
    """
    icon_path = os.path.expanduser("~/.local/share/icons/WhiteSur/apps/scalable/snowpulse.svg")
    if not os.path.exists(icon_path):
        icon_path = str(get_project_root() / "favicon.svg")

    try:
        cmd = ["notify-send", "-a", "SnowPulse AI", "-u", urgency]
        if os.path.exists(icon_path):
            cmd.extend(["-i", icon_path])
        cmd.extend([title, message])
        subprocess.run(cmd, check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return True
    except Exception:
        return False


def install_desktop_integration() -> dict[str, str]:
    """
    Installs .desktop entry and icons into Ubuntu user directories.
    """
    root = get_project_root()
    svg_source = root / "favicon.svg"

    home = Path.home()
    results = {}

    # 1. Install icons
    icon_targets = [
        home / ".local/share/icons/WhiteSur/apps/scalable/snowpulse.svg",
        home / ".local/share/icons/WhiteSur-dark/apps/scalable/snowpulse.svg",
        home / ".local/share/icons/WhiteSur-light/apps/scalable/snowpulse.svg",
        home / ".local/share/icons/hicolor/scalable/apps/snowpulse.svg",
    ]

    for target in icon_targets:
        try:
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(svg_source, target)
            results[f"icon_{target.parent.name}"] = str(target)
        except Exception as e:
            results[f"icon_err_{target.name}"] = str(e)

    # 2. Install CLI binary in ~/.local/bin/snowpulse
    local_bin = home / ".local/bin"
    local_bin.mkdir(parents=True, exist_ok=True)
    launcher_script = local_bin / "snowpulse"

    cli_script_content = f"""#!/usr/bin/env bash
# SnowPulse AI - Native Ubuntu Launcher
PROJECT_DIR="{root}"
VENV_PYTHON="$PROJECT_DIR/backend/.venv/bin/python3"

if [ ! -f "$VENV_PYTHON" ]; then
    VENV_PYTHON="$(which python3)"
fi

export PYTHONPATH="$PROJECT_DIR/backend:$PYTHONPATH"
export SNOWPULSE_HOME="$HOME/.snowpulse"
mkdir -p "$SNOWPULSE_HOME"

exec "$VENV_PYTHON" -m app.native.cli "$@"
"""
    launcher_script.write_text(cli_script_content)
    launcher_script.chmod(0o755)
    results["launcher"] = str(launcher_script)

    # 3. Install .desktop file
    apps_dir = home / ".local/share/applications"
    apps_dir.mkdir(parents=True, exist_ok=True)
    desktop_file = apps_dir / "snowpulse.desktop"

    desktop_content = f"""[Desktop Entry]
Name=SnowPulse AI
GenericName=AI Data Analysis OS
Comment=Ubuntu Native AI for Automated Data Analysis, Machine Learning, and Exploration
Exec={launcher_script} app %U
Terminal=false
Type=Application
Icon=snowpulse
Categories=Development;Science;Education;Office;
MimeType=text/csv;text/tab-separated-values;application/json;application/vnd.apache.parquet;application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;
StartupNotify=true
StartupWMClass=snowpulse
Keywords=ai;data;analysis;analytics;machine learning;polars;dashboard;statistics;
"""
    desktop_file.write_text(desktop_content)
    desktop_file.chmod(0o644)
    results["desktop_entry"] = str(desktop_file)

    # 4. Update desktop database
    try:
        subprocess.run(["update-desktop-database", str(apps_dir)], check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        results["database_updated"] = "yes"
    except Exception:
        results["database_updated"] = "no"

    send_desktop_notification("SnowPulse AI Ready", "Ubuntu Native AI Data Analyst is installed and ready!")
    return results

