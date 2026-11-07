#!/usr/bin/env python3
"""
SnowPulse AI - Debian / Ubuntu Package (.deb) Builder.
Generates a production-grade .deb package installable via `apt install ./snowpulse-ai_1.0.0_all.deb` or `dpkg -i`.
"""

import gzip
import os
import shutil
import subprocess
from pathlib import Path

PACKAGE_NAME = "snowpulse-ai"
VERSION = "1.0.0"
ARCHITECTURE = "all"
MAINTAINER = "navisjoshvadonel <navisjoshvadonel@github.com>"
DESCRIPTION = "Ubuntu Native AI Data Analysis & Predictive Analytics Suite"

ROOT_DIR = Path(__file__).resolve().parent
BUILD_DIR = ROOT_DIR / "build" / "deb"
PKG_ROOT = BUILD_DIR / f"{PACKAGE_NAME}_{VERSION}_{ARCHITECTURE}"
DIST_DIR = ROOT_DIR / "dist"


def build_deb_package():
    print(f"[*] Building {PACKAGE_NAME} v{VERSION} for Ubuntu/Debian...")

    # Clean previous builds
    if PKG_ROOT.exists():
        shutil.rmtree(PKG_ROOT)
    DIST_DIR.mkdir(parents=True, exist_ok=True)

    # Directory structures
    debian_dir = PKG_ROOT / "DEBIAN"
    opt_dir = PKG_ROOT / "opt" / "snowpulse"
    bin_dir = PKG_ROOT / "usr" / "bin"
    apps_dir = PKG_ROOT / "usr" / "share" / "applications"
    icons_dir = PKG_ROOT / "usr" / "share" / "icons" / "hicolor" / "scalable" / "apps"
    man_dir = PKG_ROOT / "usr" / "share" / "man" / "man1"
    doc_dir = PKG_ROOT / "usr" / "share" / "doc" / PACKAGE_NAME

    for d in [debian_dir, opt_dir, bin_dir, apps_dir, icons_dir, man_dir, doc_dir]:
        d.mkdir(parents=True, exist_ok=True)

    # 1. DEBIAN/control
    control_content = f"""Package: {PACKAGE_NAME}
Version: {VERSION}
Section: science
Priority: optional
Architecture: {ARCHITECTURE}
Maintainer: {MAINTAINER}
Depends: python3 (>= 3.10), libnotify-bin
Description: {DESCRIPTION}
 SnowPulse AI provides autonomous statistical profiling, multivariate anomaly
 detection, conversational AI data analysis with safe Polars execution,
 automated machine learning (AutoML) with feature importance rankings,
 and dark glassmorphic standalone HTML reports for Ubuntu Linux.
"""
    (debian_dir / "control").write_text(control_content)

    # 2. DEBIAN/postinst
    postinst_content = """#!/bin/sh
set -e

# Update desktop application database
if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database -q /usr/share/applications || true
fi

# Update MIME database
if command -v update-mime-database >/dev/null 2>&1; then
    update-mime-database /usr/share/mime || true
fi

# Update icon cache
if command -v gtk-update-icon-cache >/dev/null 2>&1; then
    gtk-update-icon-cache -q -t -f /usr/share/icons/hicolor || true
fi

echo "Setting up snowpulse-ai... Done"
exit 0
"""
    postinst_file = debian_dir / "postinst"
    postinst_file.write_text(postinst_content)
    postinst_file.chmod(0o755)

    # 3. DEBIAN/prerm & postrm
    prerm_content = """#!/bin/sh
set -e
exit 0
"""
    prerm_file = debian_dir / "prerm"
    prerm_file.write_text(prerm_content)
    prerm_file.chmod(0o755)

    postrm_content = """#!/bin/sh
set -e
if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database -q /usr/share/applications || true
fi
if command -v gtk-update-icon-cache >/dev/null 2>&1; then
    gtk-update-icon-cache -q -t -f /usr/share/icons/hicolor || true
fi
exit 0
"""
    postrm_file = debian_dir / "postrm"
    postrm_file.write_text(postrm_content)
    postrm_file.chmod(0o755)

    # 4. Copy backend source code into /opt/snowpulse/backend
    opt_backend = opt_dir / "backend"
    shutil.copytree(
        ROOT_DIR / "backend" / "app",
        opt_backend / "app",
        ignore=shutil.ignore_patterns("__pycache__", "*.pyc", "*.joblib"),
    )

    # Copy requirements & metadata
    shutil.copyfile(ROOT_DIR / "favicon.svg", opt_dir / "favicon.svg")
    if (ROOT_DIR / "README.md").exists():
        shutil.copyfile(ROOT_DIR / "README.md", doc_dir / "README")

    # 5. /usr/bin/snowpulse launcher
    launcher_content = """#!/usr/bin/env bash
# SnowPulse AI - System Launcher
APP_DIR="/opt/snowpulse"
LOCAL_DIR="$HOME/Documents/Snowpulse AI"

# Check if local dev virtualenv exists
if [ -f "$LOCAL_DIR/backend/.venv/bin/python3" ]; then
    PYTHON_EXEC="$LOCAL_DIR/backend/.venv/bin/python3"
    export PYTHONPATH="$LOCAL_DIR/backend:$PYTHONPATH"
elif [ -f "$APP_DIR/venv/bin/python3" ]; then
    PYTHON_EXEC="$APP_DIR/venv/bin/python3"
    export PYTHONPATH="$APP_DIR/backend:$PYTHONPATH"
else
    PYTHON_EXEC="$(command -v python3)"
    export PYTHONPATH="$APP_DIR/backend:$PYTHONPATH"
fi

export SNOWPULSE_HOME="$HOME/.snowpulse"
mkdir -p "$SNOWPULSE_HOME"

exec "$PYTHON_EXEC" -m app.native.cli "$@"
"""
    launcher_file = bin_dir / "snowpulse"
    launcher_file.write_text(launcher_content)
    launcher_file.chmod(0o755)

    # 6. /usr/share/applications/snowpulse.desktop
    desktop_content = """[Desktop Entry]
Name=SnowPulse AI
GenericName=AI Data Analysis OS
Comment=Ubuntu Native AI for Automated Data Analysis, Machine Learning, and Exploration
Exec=snowpulse app %U
Terminal=false
Type=Application
Icon=snowpulse
Categories=Development;Science;Education;Office;
MimeType=text/csv;text/tab-separated-values;application/json;application/vnd.apache.parquet;application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;
StartupNotify=true
StartupWMClass=snowpulse
Keywords=ai;data;analysis;analytics;machine learning;polars;dashboard;statistics;
"""
    desktop_file = apps_dir / "snowpulse.desktop"
    desktop_file.write_text(desktop_content)
    desktop_file.chmod(0o644)

    # 7. Scalable Icon
    shutil.copyfile(ROOT_DIR / "favicon.svg", icons_dir / "snowpulse.svg")

    # 8. Man page
    man_content = """.TH SNOWPULSE 1 "November 2026" "1.0.0" "SnowPulse AI User Manual"
.SH NAME
snowpulse \\- Ubuntu Native AI Data Analyst and Analytics Suite
.SH SYNOPSIS
.B snowpulse
[\\fIcommand\\fR] [\\fIoptions\\fR] [\\fIarguments\\fR]
.SH DESCRIPTION
.B SnowPulse AI
is an enterprise-grade offline/online data analysis intelligence engine.
It autonomously profiles tabular datasets, detects statistical signals and anomalies,
trains machine learning models using AutoML, and provides conversational data interaction.
.SH COMMANDS
.TP
.B doctor
Perform system diagnostics and runtime checks.
.TP
.B analyze \\fIfilename\\fR [-r] [--open]
Vectorized exploratory data analysis, quality health score, correlations, and anomalies.
.TP
.B chat \\fIfilename\\fR [-q "\\fIquery\\fR"]
Conversational data analysis agent with Polars AST sandboxing.
.TP
.B predict \\fIfilename\\fR -t \\fItarget\\fR
AutoML training and top 10 feature importance rankings.
.TP
.B report \\fIfilename\\fR [-o \\fIout.html\\fR] [--open]
Generate a standalone dark glassmorphic HTML report with interactive ECharts.
.TP
.B install-desktop
Install desktop launcher, MIME associations, and WhiteSur icons for current user.
.TP
.B serve [--port \\fIPORT\\fR]
Launch native SnowPulse REST API server.
.SH AUTHOR
SnowPulse AI Team <navisjoshvadonel@github.com>
"""
    with gzip.open(man_dir / "snowpulse.1.gz", "wb") as f_out:
        f_out.write(man_content.encode("utf-8"))

    # 9. Build Debian Package using dpkg-deb
    deb_filename = DIST_DIR / f"{PACKAGE_NAME}_{VERSION}_{ARCHITECTURE}.deb"
    cmd = ["dpkg-deb", "--build", "--root-owner-group", str(PKG_ROOT), str(deb_filename)]
    print(f"[*] Running: {' '.join(cmd)}")
    subprocess.run(cmd, check=True)

    print(f"[✓] Package successfully created: {deb_filename}")
    print(f"[*] Size: {deb_filename.stat().st_size / 1024:.1f} KB")
    return deb_filename


if __name__ == "__main__":
    build_deb_package()
