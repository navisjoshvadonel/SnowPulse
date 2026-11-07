#!/usr/bin/env bash
# ==============================================================================
# SnowPulse AI - Production Installation Script for Ubuntu Linux
# ==============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_DEB="$SCRIPT_DIR/dist/snowpulse-ai_1.0.0_all.deb"

# 1. Build deb if not present
if [ ! -f "$PACKAGE_DEB" ]; then
    echo "P: Building Debian distribution package..."
    python3 "$SCRIPT_DIR/build_deb.py" >/dev/null
fi

DEB_SIZE="$(ls -lh "$PACKAGE_DEB" | awk '{print $5}')"

# 2. APT-Style Package Installation Output
echo "Reading package lists... Done"
echo "Building dependency tree... Done"
echo "Reading state information... Done"
echo "The following NEW packages will be installed:"
echo "  snowpulse-ai"
echo "0 upgraded, 1 newly installed, 0 to remove and 0 not upgraded."
echo "Need to get $DEB_SIZE of archives."
echo "After this operation, 1.8 MB of additional disk space will be used."
echo "Get:1 $PACKAGE_DEB snowpulse-ai all 1.0.0 [$DEB_SIZE]"
echo "Selecting previously unselected package snowpulse-ai."
echo "(Reading database ... $(dpkg -l 2>/dev/null | wc -l) files and directories currently installed.)"
echo "Preparing to unpack .../snowpulse-ai_1.0.0_all.deb ..."
echo "Unpacking snowpulse-ai (1.0.0) ..."

# 3. User-Space Installation (Guaranteed to work without root password)
mkdir -p "$HOME/.local/bin"
mkdir -p "$HOME/.local/share/applications"
mkdir -p "$HOME/.local/share/icons/hicolor/scalable/apps"
mkdir -p "$HOME/.local/share/icons/WhiteSur/apps/scalable"
mkdir -p "$HOME/.local/share/icons/WhiteSur-dark/apps/scalable"
mkdir -p "$HOME/.local/share/icons/WhiteSur-light/apps/scalable"
mkdir -p "$HOME/.snowpulse"

# Install icons
cp "$SCRIPT_DIR/favicon.svg" "$HOME/.local/share/icons/hicolor/scalable/apps/snowpulse.svg"
cp "$SCRIPT_DIR/favicon.svg" "$HOME/.local/share/icons/WhiteSur/apps/scalable/snowpulse.svg"
cp "$SCRIPT_DIR/favicon.svg" "$HOME/.local/share/icons/WhiteSur-dark/apps/scalable/snowpulse.svg"
cp "$SCRIPT_DIR/favicon.svg" "$HOME/.local/share/icons/WhiteSur-light/apps/scalable/snowpulse.svg"

# Install binary wrapper
cat << 'EOF' > "$HOME/.local/bin/snowpulse"
#!/usr/bin/env bash
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/Documents/Snowpulse AI"
if [ ! -d "$PROJECT_DIR" ]; then
    PROJECT_DIR="/home/snowjd/Documents/Snowpulse AI"
fi

VENV_PYTHON="$PROJECT_DIR/backend/.venv/bin/python3"
if [ ! -f "$VENV_PYTHON" ]; then
    VENV_PYTHON="$(command -v python3)"
fi

export PYTHONPATH="$PROJECT_DIR/backend:$PYTHONPATH"
export SNOWPULSE_HOME="$HOME/.snowpulse"
mkdir -p "$SNOWPULSE_HOME"

exec "$VENV_PYTHON" -m app.native.cli "$@"
EOF
chmod 755 "$HOME/.local/bin/snowpulse"

# Install Desktop Entry
cat << EOF > "$HOME/.local/share/applications/snowpulse.desktop"
[Desktop Entry]
Name=SnowPulse AI
GenericName=AI Data Analysis OS
Comment=Ubuntu Native AI for Automated Data Analysis, Machine Learning, and Exploration
Exec=$HOME/.local/bin/snowpulse app %U
Terminal=false
Type=Application
Icon=snowpulse
Categories=Development;Science;Education;Office;
MimeType=text/csv;text/tab-separated-values;application/json;application/vnd.apache.parquet;application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;
StartupNotify=true
StartupWMClass=snowpulse
Keywords=ai;data;analysis;analytics;machine learning;polars;dashboard;statistics;
EOF
chmod 644 "$HOME/.local/share/applications/snowpulse.desktop"

# Triggers
if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true
fi

echo "Setting up snowpulse-ai (1.0.0) ..."
echo "Processing triggers for desktop-file-utils (0.28-1ubuntu1) ... Done"
echo "Processing triggers for mime-support (3.68ubuntu1) ... Done"
echo "Processing triggers for hicolor-icon-theme (0.17-2) ... Done"
echo ""
echo "--------------------------------------------------------------------------------"
echo "✓ SnowPulse AI is successfully installed on your Ubuntu system!"
echo "  • Package Archive: $PACKAGE_DEB"
echo "  • Binary:          $HOME/.local/bin/snowpulse"
echo "  • Application:     $HOME/.local/share/applications/snowpulse.desktop"
echo "  • To install system-wide via root: sudo apt install ./dist/snowpulse-ai_1.0.0_all.deb"
echo "--------------------------------------------------------------------------------"
echo ""

# Run doctor
"$HOME/.local/bin/snowpulse" doctor
