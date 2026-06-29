import io
import logging
import joblib
import numpy as np
import pandas as pd
from typing import Any, Dict, List
from ..storage.service import storage_service

logger = logging.getLogger("snowpulse.forecasting.predictor")

class ForecastingPredictor:
    """
    Retrieves serialized forecast models from MinIO, runs inference,
    generates prediction confidence bounds, and produces analytical explanations.
    """
    def __init__(self, dataset_id: int):
        self.dataset_id = dataset_id
        self.model_key = f"forecaster_{dataset_id}.joblib"
        
        try:
            model_bytes = storage_service.get_file("models", self.model_key)
            self.payload = joblib.load(io.BytesIO(model_bytes))
            self.model = self.payload["fitted_model"]
            self.model_name = self.payload["model_name"]
            self.target_col = self.payload["target_col"]
            self.last_date = pd.to_datetime(self.payload["last_date"])
            self.historical_values = self.payload["series_values"]
            self.historical_dates = self.payload["series_dates"]
            self.loaded = True
        except Exception as e:
            logger.error(f"Failed to load forecast model for dataset {dataset_id}: {e}")
            self.loaded = False

    def predict(self, steps: int = 30) -> Dict[str, Any]:
        """
        Runs model forecast and calculates upper/lower confidence bounds.
        """
        if not self.loaded:
            raise RuntimeError(f"Forecast model not loaded or not found for dataset {self.dataset_id}")

        # Generate future dates
        future_dates = pd.date_range(start=self.last_date + pd.Timedelta(days=1), periods=steps, freq='D')
        future_dates_str = [str(d.date()) for d in future_dates]

        # Calculate forecast values and confidence intervals
        forecast_values = []
        lower_bounds = []
        upper_bounds = []

        try:
            if self.model_name in ("ARIMA", "SARIMA"):
                # Get forecast results object containing standard errors
                results = self.model.get_forecast(steps=steps)
                forecast_values = results.predicted_mean.tolist()
                
                # 95% confidence intervals
                conf_int = results.conf_int(alpha=0.05)
                lower_bounds = conf_int.iloc[:, 0].tolist()
                upper_bounds = conf_int.iloc[:, 1].tolist()
            else:
                # Exponential Smoothing (ETS) does not natively offer standard errors easily,
                # we approximate standard errors using residual variance
                forecast_values = self.model.forecast(steps=steps).tolist()
                residuals = self.model.resid
                std_err = np.std(residuals) if len(residuals) > 0 else 1.0
                
                # Expand error band over time step t
                for i in range(steps):
                    margin = 1.96 * std_err * np.sqrt(i + 1)
                    lower_bounds.append(forecast_values[i] - margin)
                    upper_bounds.append(forecast_values[i] + margin)

        except Exception as e:
            logger.error(f"Prediction failed: {e}")
            # Fallback to simple extrapolation
            last_val = self.historical_values[-1]
            diff = np.mean(np.diff(self.historical_values[-10:])) if len(self.historical_values) > 10 else 0
            forecast_values = [last_val + (diff * (i + 1)) for i in range(steps)]
            lower_bounds = [v * 0.9 for v in forecast_values]
            upper_bounds = [v * 1.1 for v in forecast_values]

        # Clean NaN or inf values
        forecast_values = [float(v) if np.isfinite(v) else 0.0 for v in forecast_values]
        lower_bounds = [float(v) if np.isfinite(v) else 0.0 for v in lower_bounds]
        upper_bounds = [float(v) if np.isfinite(v) else 0.0 for v in upper_bounds]

        # Explain the forecast
        explanation = self.generate_explanation(forecast_values, steps)

        return {
            "target_column": self.target_col,
            "model_type": self.model_name,
            "future_dates": future_dates_str,
            "forecast_values": forecast_values,
            "lower_bounds": lower_bounds,
            "upper_bounds": upper_bounds,
            "historical_dates": self.historical_dates[-30:], # Last 30 hist points for UI charts
            "historical_values": self.historical_values[-30:],
            "explanation": explanation
        }

    def generate_explanation(self, forecast: List[float], steps: int) -> str:
        """
        Generates textual descriptions of the forecast trend and overall trajectory.
        """
        if not forecast:
            return "No forecast generated."

        start_val = forecast[0]
        end_val = forecast[-1]
        pct_change = ((end_val - start_val) / (start_val or 1.0)) * 100

        trend_direction = "increasing" if pct_change > 2.0 else "decreasing" if pct_change < -2.0 else "stable"
        
        explanation = (
            f"Using the optimal {self.model_name} model, the platform forecasts that '{self.target_col}' "
            f"is projected to follow a {trend_direction} trend over the next {steps} days, "
            f"changing from a starting value of {start_val:,.2f} to {end_val:,.2f} ({pct_change:+.1f}% overall shift). "
        )

        if trend_direction == "increasing":
            explanation += "This suggests strong growth momentum in the dataset."
        elif trend_direction == "decreasing":
            explanation += "This indicates downward pressure; operational reviews may be warranted to prevent decline."
        else:
            explanation += "The forecast indicates highly consistent, sideways behavior."

        return explanation
