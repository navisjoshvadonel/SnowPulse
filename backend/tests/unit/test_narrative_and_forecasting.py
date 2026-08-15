import polars as pl
import pytest
from app.forecasting.generalized_forecaster import ForecastResult, GeneralizedForecaster
from app.insights.narrative_engine import NarrativeEngine


def test_narrative_engine_summary():
    df = pl.DataFrame({
        "revenue": [100.0, 200.0, 150.0, 300.0, 250.0],
        "region": ["USA", "Europe", "USA", "APAC", "USA"],
        "date": ["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04", "2026-01-05"]
    })

    schema = {
        "columns": [
            {"name": "revenue", "inferred_role": "metric"},
            {"name": "region", "inferred_role": "geo"},
            {"name": "date", "inferred_role": "temporal"}
        ]
    }

    result = NarrativeEngine.generate_narrative_summary(df, schema)

    assert "narrative_title" in result
    assert result["export_ready"] is True
    assert len(result["ranked_insights"]) == 3
    assert result["ranked_insights"][0]["type"] == "headline"
    assert result["ranked_insights"][1]["type"] == "causal_driver"
    assert result["ranked_insights"][2]["type"] == "temporal_acceleration"


def test_narrative_engine_fallback():
    df = pl.DataFrame({"count": [10, 20, 30]})
    schema = {"columns": []}

    result = NarrativeEngine.generate_narrative_summary(df, schema)

    assert "Count" in result["narrative_title"] or "count" in result["narrative_title"]
    assert result["export_ready"] is True


def test_generalized_forecaster_with_temporal():
    df = pl.DataFrame({
        "sales": [100.0, 120.0, 140.0, 160.0, 180.0],
        "month": ["Jan", "Feb", "Mar", "Apr", "May"]
    })

    res = GeneralizedForecaster.forecast(df, metric_col="sales", temporal_col="month", periods=6, scenario_multiplier=1.2)

    assert isinstance(res, ForecastResult)
    assert res.metric_column == "sales"
    assert res.temporal_column == "month"
    assert len(res.historical_points) == 5
    assert len(res.forecast_points) == 6
    assert res.scenario_multiplier == 1.2
    assert res.forecast_points[0].is_forecast is True
    assert res.forecast_points[0].yhat_upper >= res.forecast_points[0].yhat_lower


def test_generalized_forecaster_missing_column():
    df = pl.DataFrame({"sales": [10, 20]})
    with pytest.raises(ValueError, match="not found in DataFrame"):
        GeneralizedForecaster.forecast(df, metric_col="unknown_col")


def test_generalized_forecaster_index_fallback():
    df = pl.DataFrame({
        "metric": [50.0, 60.0, 70.0]
    })
    res = GeneralizedForecaster.forecast(df, metric_col="metric")
    assert res.temporal_column == "step_index"
    assert len(res.forecast_points) == 12
