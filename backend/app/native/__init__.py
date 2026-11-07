"""
SnowPulse AI - Ubuntu Native AI Suite.
High-performance local data analysis, AutoML, conversational analytics, and desktop integration.
"""

import warnings
warnings.filterwarnings("ignore", category=FutureWarning, module="google.generativeai")

from .analyzer import NativeDataAnalyzer
from .automl import NativeAutoMLEngine
from .chat import NativeDataChatAgent
from .cleaner import NativeDataPreprocessor
from .desktop import install_desktop_integration, send_desktop_notification
from .gui import DesktopAppAPI, launch_native_desktop_app
from .loader import load_dataset
from .report import generate_html_report

__all__ = [
    "load_dataset",
    "NativeDataPreprocessor",
    "NativeDataAnalyzer",
    "NativeDataChatAgent",
    "generate_html_report",
    "NativeAutoMLEngine",
    "DesktopAppAPI",
    "launch_native_desktop_app",
    "install_desktop_integration",
    "send_desktop_notification",
]
