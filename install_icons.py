#!/usr/bin/env python3
"""
SnowPulse AI - Icon Generator & Desktop Integration Installer.
Renders SVG into multi-resolution PNGs and installs desktop entries directly to ~/Desktop and Dash.
"""

from pathlib import Path
import subprocess
import shutil
import cairosvg

PROJECT_ROOT = Path(__file__).resolve().parent
SVG_PATH = PROJECT_ROOT / "favicon.svg"
HOME = Path.home()

def install_all_icons():
    print("[*] Generating multi-resolution PNGs from SVG...")

    # Render PNGs
    resolutions = [512, 256, 128, 64, 48, 32]
    png_files = {}

    svg_content = SVG_PATH.read_bytes()

    for res in resolutions:
        out_png = PROJECT_ROOT / f"logo_{res}.png"
        cairosvg.svg2png(bytestring=svg_content, write_to=str(out_png), output_width=res, output_height=res)
        png_files[res] = out_png
        print(f"  ✓ Rendered {res}x{res}: {out_png}")

    # Copy 512 as main snowpulse.png
    main_png = HOME / ".local/share/icons/snowpulse.png"
    main_png.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(png_files[512], main_png)

    # 1. Install into hicolor directories
    for res in resolutions:
        target_dir = HOME / f".local/share/icons/hicolor/{res}x{res}/apps"
        target_dir.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(png_files[res], target_dir / "snowpulse.png")

    # Scalable SVG
    scalable_dir = HOME / ".local/share/icons/hicolor/scalable/apps"
    scalable_dir.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(SVG_PATH, scalable_dir / "snowpulse.svg")

    # 2. Install into WhiteSur theme directories
    for theme in ["WhiteSur", "WhiteSur-dark", "WhiteSur-light"]:
        ws_dir = HOME / f".local/share/icons/{theme}/apps/scalable"
        ws_dir.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(SVG_PATH, ws_dir / "snowpulse.svg")

    # 3. Create .desktop file content with absolute icon path as well as named icon
    launcher_exec = HOME / ".local/bin/snowpulse"
    desktop_content = f"""[Desktop Entry]
Version=1.0
Name=SnowPulse AI
GenericName=AI Data Analysis OS
Comment=SnowPulse - Ubuntu Native AI Data Analyst (Pulse & Predictive Intelligence)
Exec={launcher_exec} app %U
Path={PROJECT_ROOT}
Icon={main_png}
Terminal=false
Type=Application
Categories=Development;Science;Education;Office;Utility;
MimeType=text/csv;text/tab-separated-values;application/json;application/vnd.apache.parquet;application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;
StartupNotify=true
StartupWMClass=snowpulse
Keywords=ai;data;analysis;analytics;machine learning;polars;pulse;dashboard;statistics;
"""

    # Applications menu
    app_menu_file = HOME / ".local/share/applications/snowpulse.desktop"
    app_menu_file.parent.mkdir(parents=True, exist_ok=True)
    app_menu_file.write_text(desktop_content)
    app_menu_file.chmod(0o755)

    # USER'S ACTUAL DESKTOP (~/Desktop)
    user_desktop_file = HOME / "Desktop" / "SnowPulse AI.desktop"
    user_desktop_file.write_text(desktop_content)
    user_desktop_file.chmod(0o755)
    print(f"[✓] Installed desktop shortcut: {user_desktop_file}")

    # Mark desktop file as trusted in GNOME
    try:
        subprocess.run(["gio", "set", str(user_desktop_file), "metadata::trusted", "true"], check=False)
    except Exception:
        pass

    # Update icon caches
    try:
        subprocess.run(["gtk-update-icon-cache", "-f", "-t", str(HOME / ".local/share/icons/hicolor")], check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception:
        pass

    try:
        subprocess.run(["update-desktop-database", str(HOME / ".local/share/applications")], check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception:
        pass

    # Clean temporary pngs in root
    for p in png_files.values():
        if p.exists():
            p.unlink()

    print("[✓] All icons and Desktop shortcuts successfully installed!")

if __name__ == "__main__":
    install_all_icons()

