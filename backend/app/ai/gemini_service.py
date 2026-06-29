import json
import os
from typing import Any

import google.generativeai as genai


class GeminiService:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        self.model_name = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")

        if self.api_key:
            genai.configure(api_key=self.api_key)
            self.model = genai.GenerativeModel(self.model_name)
            self.active = True
        else:
            self.active = False
            print("Gemini API key not found. Running in offline statistical fallback mode.")

    def generate_dashboard_insights(self, stats_context: str) -> dict[str, str]:
        """
        Generates structured executive insights for the 4 panels:
        - Headline Insight (Panel 1)
        - Trend Insight (Panel 2)
        - Geo Insight (Panel 3)
        - Recommendations list (Panel 4)
        """
        if not self.active:
            return self._generate_fallback_insights(stats_context)

        prompt = f"""
You are the AI brain of SNOW, an elite enterprise analytics platform.
Given the following data statistics context, generate four structured outputs in JSON format.

=== DATA STATS CONTEXT ===
{stats_context}
=== END CONTEXT ===

You must return EXACTLY a JSON object with these keys:
1. "headline_insight": A 1-2 sentence executive summary of overall performance (e.g. growth driver, total revenue status).
2. "trend_insight": A 1-2 sentence insight about the historical trend (e.g. acceleration in Q2, volatility, steady climb).
3. "geo_insight": A 1-2 sentence overview of geographic highlights (e.g. APAC leading growth, regional concentrations).
4. "recommendations": An array of 3 concrete strategic recommendations based on the anomalies or top segments.

CRITICAL: Return ONLY valid, minified JSON. Do not include markdown codeblocks or tripe-backticks in your output. Just return the raw JSON string.
"""
        try:
            response = self.model.generate_content(prompt)
            text = response.text.strip()
            # Clean possible markdown wrapping
            if text.startswith("```json"):
                text = text[7:]
            if text.endswith("```"):
                text = text[:-3]
            text = text.strip()

            data = json.loads(text)
            return {
                "headline_insight": data.get("headline_insight", ""),
                "trend_insight": data.get("trend_insight", ""),
                "geo_insight": data.get("geo_insight", ""),
                "recommendations": data.get("recommendations", [])
            }
        except Exception as e:
            print(f"Gemini API generation error: {e}. Falling back.")
            return self._generate_fallback_insights(stats_context)

    def ask_copilot(self, query: str, stats_context: str) -> str:
        """
        Answers general analytical questions based on the dataset metrics.
        """
        if not self.active:
            return self._generate_fallback_copilot_response(query, stats_context)

        prompt = f"""
You are the Executive AI Copilot for SNOW Analytics.
A user has asked a question about their business performance.
Answer the user's question concisely using the statistical data context provided. Keep it professional, data-driven, and easy to read for C-level executives.

=== DATA STATS CONTEXT ===
{stats_context}
=== END CONTEXT ===

User Question: "{query}"

Respond in clean markdown. Format numbers, percentages, and metrics clearly. Keep your response under 150 words if possible.
"""
        try:
            response = self.model.generate_content(prompt)
            return response.text.strip()
        except Exception as e:
            print(f"Gemini API copilot error: {e}. Falling back.")
            return self._generate_fallback_copilot_response(query, stats_context)

    def _generate_fallback_insights(self, stats_context: str) -> dict[str, Any]:
        # Offline rule-based summarizer using string parsing of statistical context
        lines = stats_context.split("\n")
        stats = {}
        for line in lines:
            if ":" in line:
                k, v = line.split(":", 1)
                stats[k.strip().lower()] = v.strip()

        metric = stats.get("primary target metric", "Revenue")
        total_val = stats.get("total aggregate value", "0.00")
        growth = stats.get("growth rate (period-over-period)", "0.0%")
        top_geo = stats.get("top performing region/segment", "Global")
        anoms = stats.get("statistical anomalies/outliers detected", "0")

        return {
            "headline_insight": f"Total {metric} is {total_val}, registering a period change of {growth}. Performance remains stable.",
            "trend_insight": f"Historical aggregates show a {float(growth.replace('%','')) >= 0 and 'positive' or 'negative'} trajectory. Growth is heavily concentrated.",
            "geo_insight": f"Segment/Region '{top_geo}' is the primary driver, holding the dominant share of transactions.",
            "recommendations": [
                f"Double down on the top performing segment: '{top_geo}' to capture maximum returns.",
                f"Audit the {anoms} outlier anomalies flagged to identify potential data quality errors or supply chain issues.",
                "Review conversion performance trends to identify mid-month drops."
            ],
            "offline_mode": True
        }

    def _generate_fallback_copilot_response(self, query: str, stats_context: str) -> str:
        q_lower = query.lower()
        lines = stats_context.split("\n")
        stats = {}
        for line in lines:
            if ":" in line:
                k, v = line.split(":", 1)
                stats[k.strip().lower()] = v.strip()

        metric = stats.get("primary target metric", "Revenue")
        total_val = stats.get("total aggregate value", "0.00")
        growth = stats.get("growth rate (period-over-period)", "0.0%")
        top_geo = stats.get("top performing region/segment", "Global")
        anoms = stats.get("statistical anomalies/outliers detected", "0")

        if "revenue" in q_lower or "sales" in q_lower or "total" in q_lower:
            return f"**Analysis of Total Metric Volume:**\n\nThe total aggregate value of **{metric}** in this dataset is **{total_val}**, with a growth trajectory of **{growth}** compared to the previous half of the period. This indicates a steady operational velocity."
        elif "predict" in q_lower or "forecast" in q_lower:
            try:
                g_val = float(growth.replace("%", ""))
                direction = "upward" if g_val >= 0 else "downward"
                return f"**Forecast Summary:**\n\nBased on historical linear trend calculations, the future projection points to a **{direction}** trajectory. We expect sales to scale by approximately **{growth}** in the next cycle, assuming constant market conditions."
            except Exception:
                return "**Forecast Summary:**\n\nFuture projection suggests a continuation of current trendlines. We recommend monitoring key segment fluctuations."
        elif "anomaly" in q_lower or "outlier" in q_lower or "why did" in q_lower:
            return f"**Anomalies & Variance Report:**\n\nThe system detected **{anoms} statistical anomalies** in the dataset. These points fall outside standard Z-score thresholds. The primary variances are caused by spikes in volume or category adjustments."
        else:
            return f"**Copilot General Response (Offline Mode):**\n\nHere is what we know about the current dataset:\n- **Primary Metric:** {metric}\n- **Total Volume:** {max(0, float(total_val.replace(',','')) if '.' in total_val else 0):,.2f}\n- **Period Change:** {growth}\n- **Top Regional Hub:** {top_geo}\n\nPlease add a valid `GEMINI_API_KEY` to your environment variables to enable dynamic, full-context natural language querying."
