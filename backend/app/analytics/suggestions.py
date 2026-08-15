'''suggestions.py

Utility helpers to expose chart suggestions based on the rule engine.
'''

from __future__ import annotations

import polars as pl

from .profiler import DatasetProfile
from .rules_engine import ChartSuggester


def suggest_charts(df: pl.DataFrame, profile: DatasetProfile, top_n: int = 3) -> list[dict]:
    """Return top‑N chart suggestion dictionaries.

    Parameters
    ----------
    df: pl.DataFrame
        Loaded dataset.
    profile: DatasetProfile
        Profile generated for the dataset.
    top_n: int, optional
        Number of suggestions to return (default 3).
    """
    suggester = ChartSuggester(df, profile)
    return suggester.suggest(top_n=top_n)
