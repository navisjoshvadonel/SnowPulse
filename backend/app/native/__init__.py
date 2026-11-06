"""
SnowPulse AI - Ubuntu Native AI Suite.
High-performance local data analysis, AutoML, conversational analytics, and desktop integration.
"""

import warnings

warnings.filterwarnings("ignore", category=FutureWarning, module="google.generativeai")

from .analyzer import NativeDataAnalyzer
from .automl import NativeAutoMLEngine
from .chat import NativeDataChatAgent
from .desktop import install_desktop_integration, send_desktop_notification
from .loader import load_dataset
from .report import generate_html_report

__all__ = [
    "load_dataset",
    "NativeDataAnalyzer",
    "NativeDataChatAgent",
    "generate_html_report",
    "NativeAutoMLEngine",
    "install_desktop_integration",
    "send_desktop_notification",
]
