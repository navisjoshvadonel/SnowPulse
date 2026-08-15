from unittest.mock import MagicMock

import polars as pl
from app.analytics.profiler import DatasetProfiler
from app.analytics.rules_engine import ChartSuggester
from app.analytics.semantic_enricher import SemanticEnricher


def test_semantic_enricher_fallback():
    df = pl.DataFrame({
        "revenue_usd": [100.0, 200.0, 150.0, 300.0, 250.0],
        "category_name": ["Electronics", "Clothing", "Electronics", "Clothing", "Home"],
        "order_date": ["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04", "2026-01-05"],
    })
    profile = DatasetProfiler.profile_full(df)
    suggestions = ChartSuggester(df, profile).suggest(top_n=3)

    mock_gemini = MagicMock()
    mock_gemini.active = False  # Offline mode

    enricher = SemanticEnricher(gemini_service=mock_gemini)
    enrichment = enricher.enrich(profile, suggestions, dataset_name="Sales Data")

    assert enrichment.is_fallback is True
    assert "Sales Data" in enrichment.dataset_summary
    assert enrichment.column_business_names["revenue_usd"] == "Revenue Usd"
    assert len(enrichment.enriched_suggestions) == len(suggestions)
    for sug in enrichment.enriched_suggestions:
        assert sug.title is not None
        assert sug.subtitle is not None


def test_semantic_enricher_active_gemini():
    df = pl.DataFrame({
        "mrr": [10.0, 20.0, 30.0, 40.0, 50.0],
        "churn": [0, 1, 0, 0, 1]
    })
    profile = DatasetProfiler.profile_full(df)
    suggestions = ChartSuggester(df, profile).suggest(top_n=2)

    mock_gemini = MagicMock()
    mock_gemini.active = True
    mock_response = MagicMock()
    mock_response.text = '''{
        "dataset_summary": "SaaS Subscription metrics tracking MRR and customer churn.",
        "column_business_names": {"mrr": "Monthly Recurring Revenue ($)", "churn": "Customer Churn Status"},
        "interesting_relationships": ["Higher MRR accounts show lower churn probability."],
        "enriched_suggestions": [
            {
                "chart": "scatter",
                "columns": ["mrr", "churn"],
                "score": 0.8,
                "title": "MRR vs Churn Distribution",
                "subtitle": "Analysis of recurring revenue against cancellation events.",
                "takeaway": "Key correlation detected.",
                "details": {}
            }
        ]
    }'''
    mock_gemini.model.generate_content.return_value = mock_response

    enricher = SemanticEnricher(gemini_service=mock_gemini)
    enrichment = enricher.enrich(profile, suggestions, dataset_name="SaaS Metrics")

    assert enrichment.is_fallback is False
    assert "SaaS Subscription" in enrichment.dataset_summary
    assert enrichment.column_business_names["mrr"] == "Monthly Recurring Revenue ($)"
    assert len(enrichment.interesting_relationships) == 1
    assert enrichment.enriched_suggestions[0].title == "MRR vs Churn Distribution"
