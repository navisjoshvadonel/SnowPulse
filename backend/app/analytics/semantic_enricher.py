"""
semantic_enricher.py

Provides the "Soft" Semantic Layer for SnowPulse using Gemini.
All structural typing, chart pattern detection, and data parsing are 100% deterministic
(Polars + DatasetProfiler + rules_engine). Gemini is invoked ONLY for high-level soft tasks:
1. Column semantic naming (business domain labels)
2. Executive natural language dataset summary
3. Human-relevant relationship callouts
4. Human-friendly titles/labels for auto-generated charts from rules_engine
"""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional
from pydantic import BaseModel

from .profiler import DatasetProfile
from ..ai.gemini_service import GeminiService

logger = logging.getLogger("snowpulse.analytics.semantic")


class EnrichedChartSuggestion(BaseModel):
    chart: str
    columns: list[str]
    score: float
    title: str
    subtitle: str
    takeaway: str
    details: dict[str, Any] = {}


class DatasetSemanticEnrichment(BaseModel):
    dataset_summary: str
    column_business_names: dict[str, str]
    interesting_relationships: list[str]
    enriched_suggestions: list[EnrichedChartSuggestion]
    is_fallback: bool = False


class SemanticEnricher:
    """
    Applies Gemini LLM ONLY for high-level semantic enrichment ("soft" layer):
    - Column semantic naming
    - Executive summary narrative
    - Human-relevant relationship callouts
    - Human-friendly chart titles & annotations
    """

    def __init__(self, gemini_service: Optional[GeminiService] = None):
        self.gemini = gemini_service or GeminiService()

    def enrich(
        self,
        profile: DatasetProfile,
        chart_suggestions: List[Dict[str, Any]],
        dataset_name: str = "Dataset"
    ) -> DatasetSemanticEnrichment:
        """
        Takes a deterministic DatasetProfile and rules_engine chart suggestions,
        returns semantic enrichment metadata.
        """
        if not self.gemini.active:
            return self._fallback_enrichment(profile, chart_suggestions, dataset_name)

        # Build concise statistical context for Gemini prompt (low token footprint)
        col_summaries = []
        for c in profile.columns:
            col_summaries.append(
                f"- {c.name}: role={c.inferred_role}, dtype={c.dtype_category}, semantic={c.semantic_type}, cardinality={c.cardinality}"
            )

        corrs = []
        if profile.correlation_matrix and profile.correlation_matrix.columns:
            matrix = profile.correlation_matrix.matrix
            cols = profile.correlation_matrix.columns
            for i in range(len(cols)):
                for j in range(i + 1, len(cols)):
                    val = matrix[i][j]
                    if abs(val) >= 0.3:
                        corrs.append(f"{cols[i]} vs {cols[j]}: r={val:.2f}")

        suggestions_summary = []
        for s in chart_suggestions:
            suggestions_summary.append(
                f"- ChartType: {s.get('chart')}, Columns: {s.get('columns')}, Score: {s.get('score', 0):.2f}, Details: {s.get('details')}"
            )

        prompt = f"""
You are the AI Semantic Enrichment Layer for SnowPulse enterprise analytics.
Given the following deterministic statistical profile of dataset '{dataset_name}', generate human-friendly semantic descriptions.

=== DETERMINISTIC SCHEMA & METADATA ===
Total Rows: {profile.total_rows}
Columns:
{chr(10).join(col_summaries)}

Top Correlations:
{chr(10).join(corrs[:8]) if corrs else "None flagged above |r|>=0.3"}

Auto-Generated Chart Candidates (from rules engine):
{chr(10).join(suggestions_summary)}
=== END METADATA ===

Generate a JSON response with:
1. "dataset_summary": A 2-3 sentence executive overview of what this dataset represents and its main focus.
2. "column_business_names": An object mapping each raw column name to a clean, professional, human-readable title (e.g. "mrr_usd" -> "Monthly Recurring Revenue ($)").
3. "interesting_relationships": A list of 2-4 strings highlighting key relationships/correlations interesting to a business decision maker.
4. "enriched_suggestions": An array matching the chart candidates order, where each object has:
   - "chart": same chart string as input
   - "columns": same columns array as input
   - "score": numeric score from input
   - "title": a compelling, human-friendly chart title (e.g. "Revenue Impact of Ad Spend")
   - "subtitle": a 1-sentence subtitle explaining what to look for
   - "takeaway": a key takeaway message for executives
   - "details": pass through the original details dict

Return ONLY valid JSON.
"""
        try:
            response = self.gemini.model.generate_content(prompt)
            text = response.text.strip()
            if text.startswith("```json"):
                text = text[7:]
            if text.endswith("```"):
                text = text[:-3]
            data = json.loads(text.strip())

            self.gemini.record_usage(prompt, response.text, getattr(response, "usage_metadata", None))

            enriched_suggs = []
            raw_suggs = data.get("enriched_suggestions", [])
            for idx, orig in enumerate(chart_suggestions):
                gen = raw_suggs[idx] if idx < len(raw_suggs) else {}
                enriched_suggs.append(
                    EnrichedChartSuggestion(
                        chart=orig.get("chart", "bar"),
                        columns=orig.get("columns", []),
                        score=orig.get("score", 0.0),
                        title=gen.get("title") or f"{orig.get('chart', 'Chart').title()} of {', '.join(orig.get('columns', []))}",
                        subtitle=gen.get("subtitle") or "Auto-generated visualization",
                        takeaway=gen.get("takeaway") or "Identified by statistical rules engine.",
                        details=orig.get("details", {})
                    )
                )

            return DatasetSemanticEnrichment(
                dataset_summary=data.get("dataset_summary", f"Dataset '{dataset_name}' with {profile.total_rows} records."),
                column_business_names=data.get("column_business_names", {c.name: c.name.replace("_", " ").title() for c in profile.columns}),
                interesting_relationships=data.get("interesting_relationships", []),
                enriched_suggestions=enriched_suggs,
                is_fallback=False
            )
        except Exception as e:
            logger.warning(f"SemanticEnricher Gemini call failed: {e}. Using deterministic fallback.")
            return self._fallback_enrichment(profile, chart_suggestions, dataset_name)

    def _fallback_enrichment(
        self,
        profile: DatasetProfile,
        chart_suggestions: List[Dict[str, Any]],
        dataset_name: str
    ) -> DatasetSemanticEnrichment:
        """Deterministic rule-based fallback when Gemini API is offline or unavailable."""
        col_names = {c.name: c.name.replace("_", " ").title() for c in profile.columns}
        
        primary_metric = next((c.name for c in profile.columns if c.is_primary_metric), None)
        summary = f"Dataset '{dataset_name}' contains {profile.total_rows:,} records across {len(profile.columns)} attributes."
        if primary_metric:
            summary += f" The primary target metric identified is '{col_names.get(primary_metric, primary_metric)}'."

        relationships = []
        if profile.correlation_matrix and profile.correlation_matrix.columns:
            matrix = profile.correlation_matrix.matrix
            cols = profile.correlation_matrix.columns
            for i in range(len(cols)):
                for j in range(i + 1, len(cols)):
                    val = matrix[i][j]
                    if abs(val) >= 0.4:
                        rel_type = "Strong positive correlation" if val > 0 else "Strong negative correlation"
                        relationships.append(f"{rel_type} (r={val:.2f}) observed between '{cols[i]}' and '{cols[j]}'.")

        enriched_suggs = []
        for s in chart_suggestions:
            chart_type = s.get("chart", "bar")
            cols_involved = s.get("columns", [])
            col_labels = [col_names.get(c, c) for c in cols_involved]
            
            title = f"{chart_type.replace('_', ' ').title()}: {' vs '.join(col_labels)}"
            subtitle = f"Visualizing relationship across {len(cols_involved)} variables."
            takeaway = "Suggested based on statistical distribution and completeness."

            enriched_suggs.append(
                EnrichedChartSuggestion(
                    chart=chart_type,
                    columns=cols_involved,
                    score=s.get("score", 0.0),
                    title=title,
                    subtitle=subtitle,
                    takeaway=takeaway,
                    details=s.get("details", {})
                )
            )

        return DatasetSemanticEnrichment(
            dataset_summary=summary,
            column_business_names=col_names,
            interesting_relationships=relationships[:4],
            enriched_suggestions=enriched_suggs,
            is_fallback=True
        )
