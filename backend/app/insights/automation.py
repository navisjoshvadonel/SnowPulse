import logging
from typing import Any

from sqlalchemy.orm import Session

from ..analytics.engine import AnalyticsEngine
from ..models import Dataset

logger = logging.getLogger("snowpulse.insights.automation")

class InsightAutomationEngine:
    """
    Scans analytical datasets for anomalies, trends, and risk parameters.
    Scores and ranks events to generate prioritized recommendations.
    """
    def __init__(self, db: Session, dataset_id: int):
        self.db = db
        self.dataset_id = dataset_id

        # Load dataset
        ds = db.query(Dataset).filter(Dataset.id == dataset_id).first()
        if not ds:
            raise ValueError(f"Dataset {dataset_id} not found.")
        self.dataset = ds

        # Instantiate statistical analytics engine
        self.analytics_engine = AnalyticsEngine(ds.file_path)

    def run_detection(self) -> list[dict[str, Any]]:
        """
        Runs multiple anomaly scans, trend checks, and forecasts evaluations.
        Generates and saves prioritized insights into the PostgreSQL database.
        """
        from ..models import Insight  # Import here to avoid circular dependencies

        kpis = self.analytics_engine.get_kpis()
        anomalies = self.analytics_engine.get_anomalies()

        detected_insights = []

        # 1. Evaluate Growth Rate Shifts
        growth_rate = kpis.get("growth_rate", 0.0)
        if abs(growth_rate) > 10.0:
            category = "Growth" if growth_rate > 0 else "Risk"
            severity = "High" if abs(growth_rate) > 25.0 else "Medium"
            score = min(95, int(abs(growth_rate) * 2.5))

            title = f"Significant {'Growth Acceleration' if growth_rate > 0 else 'Revenue Contraction'} Detected"
            description = f"The dataset displays a {growth_rate:+.1f}% shift in overall values between the first and second half of the records."
            rec = (
                "Optimize resource allocations and inventory buffers to capture excess demand."
                if growth_rate > 0 else
                "Initiate price elasticity analysis and targeted marketing campaigns to counter the contraction."
            )
            detected_insights.append({
                "title": title, "description": description, "recommendation": rec,
                "severity": severity, "score": score, "category": category
            })

        # 2. Process Statistical Anomalies (Z-score Outliers)
        if anomalies:
            critical_count = sum(1 for a in anomalies if a["severity"] == "Critical")
            high_count = sum(1 for a in anomalies if a["severity"] == "High")

            if critical_count > 0 or high_count > 0:
                severity = "Critical" if critical_count > 0 else "High"
                score = 90 if severity == "Critical" else 75

                title = "Unusual Data Anomaly Spike Flags"
                description = f"Detected {len(anomalies)} statistical outliers. {critical_count} outliers require immediate review."

                # Extract most extreme outlier details
                extreme = max(anomalies, key=lambda a: abs(a["z_score"]))
                description += f" Most extreme outlier at row {extreme['row_index']} ({extreme['date']}) with value {extreme['value']:,.2f} (Z-Score: {extreme['z_score']:.2f})."

                rec = "Inspect data source logs for collection errors or pipeline corruption. If data is accurate, schedule an operational audit."
                detected_insights.append({
                    "title": title, "description": description, "recommendation": rec,
                    "severity": severity, "score": score, "category": "Anomaly"
                })

        # 3. Check for Data Quality Risks
        quality_score = kpis.get("quality_score", 100)
        if quality_score < 80:
            severity = "High" if quality_score < 60 else "Medium"
            score = 100 - quality_score
            title = "Degraded Dataset Integrity Rating"
            description = f"The dataset quality score has fallen to {quality_score}%. High volumes of missing values or mismatched column types were found."
            rec = "Run Pandera schema validation reports, clean nulls, and ensure mandatory columns are fully populated before compiling reports."
            detected_insights.append({
                "title": title, "description": description, "recommendation": rec,
                "severity": severity, "score": score, "category": "Risk"
            })

        # 4. Check Forecast Drift (if forecast model exists)
        try:
            from ..forecasting.predictor import ForecastingPredictor
            predictor = ForecastingPredictor(self.dataset_id)
            if predictor.loaded:
                pred_out = predictor.predict(steps=7)
                forecast_trend = pred_out.get("forecast_values", [])
                if forecast_trend:
                    f_change = ((forecast_trend[-1] - forecast_trend[0]) / (forecast_trend[0] or 1.0)) * 100
                    if f_change < -5.0:
                        detected_insights.append({
                            "title": "Negative Near-Term Forecast Trend",
                            "description": f"The forecasting models predict a downward drift of {f_change:.1f}% over the next 7 periods.",
                            "recommendation": "Review short-term pipeline forecasts, reduce non-essential overheads, and run demand promotions.",
                            "severity": "Medium",
                            "score": 55,
                            "category": "Forecast"
                        })
        except Exception as e:
            logger.warning(f"Failed to check forecast drift for insights: {e}")

        # 5. Check ML Churn Risks (if churn classifier exists)
        try:
            from ..ml.registry import ModelRegistry
            history = ModelRegistry.get_training_history(self.dataset_id, "churn")
            if history:
                latest_metrics = history[-1].get("metrics", {})
                acc = latest_metrics.get("accuracy", 0.0)
                detected_insights.append({
                    "title": "ML Churn Prediction Pipeline Active",
                    "description": f"Scikit-learn churn classification model successfully trained with accuracy {acc*100:.1f}%. Ready for batch customer predictions.",
                    "recommendation": "Initiate automated segment tagging and send customized retargeting email triggers to high-risk profiles.",
                    "severity": "Info",
                    "score": 35,
                    "category": "ML"
                })
        except Exception as e:
            logger.warning(f"Failed to check ML predictions for insights: {e}")

        # Save to database
        # Clear previous insights for this dataset to avoid clutter
        self.db.query(Insight).filter(Insight.dataset_id == self.dataset_id).delete()

        saved_db_objects = []
        for item in detected_insights:
            db_ins = Insight(
                dataset_id=self.dataset_id,
                title=item["title"],
                description=item["description"],
                recommendation=item["recommendation"],
                severity=item["severity"],
                score=item["score"],
                category=item["category"]
            )
            self.db.add(db_ins)
            saved_db_objects.append(db_ins)

        self.db.commit()

        # Synchronize Meilisearch index for all newly created insights
        try:
            from ..search.service import search_service
            for ins in saved_db_objects:
                search_service.index_document(
                    resource_type="insight",
                    document={
                        "id": ins.id,
                        "dataset_id": ins.dataset_id,
                        "title": ins.title,
                        "description": ins.description,
                        "content": ins.recommendation or "",
                        "category": ins.category,
                        "severity": ins.severity.lower()
                    }
                )
        except Exception as e:
            logger.error(f"Failed to index insights in search: {e}")

        return detected_insights
