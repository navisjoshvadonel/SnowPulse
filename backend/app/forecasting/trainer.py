import io
import logging
import warnings
from typing import Any

import joblib
import numpy as np
import pandas as pd
from statsmodels.tsa.arima.model import ARIMA
from statsmodels.tsa.holtwinters import ExponentialSmoothing
from statsmodels.tsa.statespace.sarimax import SARIMAX

from ..models import Dataset
from ..storage.service import storage_service

logger = logging.getLogger("snowpulse.forecasting.trainer")

class ForecastingTrainer:
    """
    Fits multiple time-series forecasting models (ARIMA, SARIMA, ETS) on a dataset,
    compares performance via backtesting, and saves the best model to MinIO.
    """
    def __init__(self, db, dataset_id: int):
        self.db = db
        self.dataset_id = dataset_id

        # Load dataset from database metadata and MinIO
        ds = db.query(Dataset).filter(Dataset.id == dataset_id).first()
        if not ds:
            raise ValueError(f"Dataset with ID {dataset_id} not found.")

        # Parse MinIO key
        # file_path format: minio://bucket/key or local path (support fallback for backward compatibility)
        if ds.file_path.startswith("minio://"):
            parts = ds.file_path.replace("minio://", "").split("/", 1)
            bucket = parts[0]
            key = parts[1]
            file_bytes = storage_service.get_file(bucket, key)
            from ..validation.quality.quality_scorer import DataQualityScorer
            self.df = DataQualityScorer.read_file_to_pandas(file_bytes, key)
        else:
            self.df = pd.read_csv(ds.file_path)

    def _prepare_time_series(self, target_col: str, date_col: str = None) -> pd.Series:
        """
        Resamples and formats the dataframe into a regularized time series.
        """
        df = self.df.copy()

        # Find date column if not provided
        if not date_col:
            date_cols = [c for c in df.columns if "date" in c.lower() or "time" in c.lower() or "timestamp" in c.lower()]
            date_col = date_cols[0] if date_cols else df.columns[0]

        df[date_col] = pd.to_datetime(df[date_col], errors='coerce')
        df = df.dropna(subset=[date_col, target_col])

        # Group by date and sort
        series = df.groupby(date_col)[target_col].sum().sort_index()

        # Infer frequency or resample to Daily ('D') or Monthly ('M') based on size
        if len(series) > 10:
            # Resample to Daily and fill missing dates with interpolation
            series = series.resample('D').mean().interpolate(method='linear')

        return series

    def _fit_arima(self, train_data: pd.Series, test_data: pd.Series) -> tuple[dict[str, float], Any] | None:
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                model = ARIMA(train_data, order=(1, 1, 1))
                fit = model.fit()
                pred = fit.forecast(steps=len(test_data))
                mape = np.mean(np.abs((test_data - pred) / test_data)) * 100
                return {
                    "mape": float(mape),
                    "aic": float(fit.aic) if fit.aic else 0.0,
                    "bic": float(fit.bic) if fit.bic else 0.0
                }, fit
        except Exception as e:
            logger.error(f"ARIMA fit failed: {e}")
            return None

    def _fit_sarima(self, train_data: pd.Series, test_data: pd.Series) -> tuple[dict[str, float], Any] | None:
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                model = SARIMAX(train_data, order=(1, 1, 1), seasonal_order=(1, 1, 1, 7), enforce_stationarity=False, enforce_invertibility=False)
                fit = model.fit(disp=False)
                pred = fit.forecast(steps=len(test_data))
                mape = np.mean(np.abs((test_data - pred) / test_data)) * 100
                return {
                    "mape": float(mape),
                    "aic": float(fit.aic) if fit.aic else 0.0,
                    "bic": float(fit.bic) if fit.bic else 0.0
                }, fit
        except Exception as e:
            logger.error(f"SARIMA fit failed: {e}")
            return None

    def _fit_ets(self, train_data: pd.Series, test_data: pd.Series) -> tuple[dict[str, float], Any] | None:
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                model = ExponentialSmoothing(train_data, trend='add', seasonal='add', seasonal_periods=7)
                fit = model.fit()
                pred = fit.forecast(steps=len(test_data))
                mape = np.mean(np.abs((test_data - pred) / test_data)) * 100
                return {
                    "mape": float(mape),
                    "aic": float(fit.aic) if fit.aic else 0.0,
                    "bic": float(fit.bic) if fit.bic else 0.0
                }, fit
        except Exception:
            try:
                model = ExponentialSmoothing(train_data, trend='add')
                fit = model.fit()
                pred = fit.forecast(steps=len(test_data))
                mape = np.mean(np.abs((test_data - pred) / test_data)) * 100
                return {
                    "mape": float(mape),
                    "aic": float(fit.aic) if fit.aic else 0.0,
                    "bic": float(fit.bic) if fit.bic else 0.0
                }, fit
            except Exception as ex:
                logger.error(f"ETS fit failed: {ex}")
                return None

    def train_and_evaluate(self, target_col: str, steps: int = 30) -> dict[str, Any]:
        """
        Runs backtests on ARIMA, SARIMA, and Exponential Smoothing.
        Selects the best model and serializes it to MinIO.
        """
        series = self._prepare_time_series(target_col)
        if len(series) < 6:
            raise ValueError("Time series too short for training forecasting models. Minimum 6 periods required.")

        # Train/Test Split for backtesting (80% train, 20% test)
        split_idx = int(len(series) * 0.8)
        train_data = series.iloc[:split_idx]
        test_data = series.iloc[split_idx:]

        best_model_name = None
        best_mape = float('inf')
        best_model_fit = None

        models_metrics = {}

        # 1. Fit ARIMA
        arima_res = self._fit_arima(train_data, test_data)
        if arima_res:
            metrics, fit = arima_res
            models_metrics["ARIMA"] = metrics
            if metrics["mape"] < best_mape:
                best_mape = metrics["mape"]
                best_model_name = "ARIMA"
                best_model_fit = fit

        # 2. Fit SARIMA
        sarima_res = self._fit_sarima(train_data, test_data)
        if sarima_res:
            metrics, fit = sarima_res
            models_metrics["SARIMA"] = metrics
            if metrics["mape"] < best_mape:
                best_mape = metrics["mape"]
                best_model_name = "SARIMA"
                best_model_fit = fit

        # 3. Fit Exponential Smoothing (ETS)
        ets_res = self._fit_ets(train_data, test_data)
        if ets_res:
            metrics, fit = ets_res
            models_metrics["ETS"] = metrics
            if metrics["mape"] < best_mape:
                best_mape = metrics["mape"]
                best_model_name = "ETS"
                best_model_fit = fit

        # If all models failed, raise error
        if not best_model_name:
            raise ValueError("All statsmodels fitting routines failed to converge.")

        # Refit best model on the FULL dataset
        logger.info(f"Refitting best model '{best_model_name}' (MAPE: {best_mape:.2f}%) on full series")

        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                if best_model_name == "ARIMA":
                    final_model = ARIMA(series, order=(1, 1, 1)).fit()
                elif best_model_name == "SARIMA":
                    final_model = SARIMAX(series, order=(1, 1, 1), seasonal_order=(1, 1, 1, 7), enforce_stationarity=False, enforce_invertibility=False).fit(disp=False)
                else:
                    # ETS
                    try:
                        final_model = ExponentialSmoothing(series, trend='add', seasonal='add', seasonal_periods=7).fit()
                    except Exception:
                        final_model = ExponentialSmoothing(series, trend='add').fit()
        except Exception as e:
            logger.warning(f"Failed to refit full series, saving validation fit instead: {e}")
            final_model = best_model_fit

        # Save to MinIO
        model_payload = {
            "model_name": best_model_name,
            "metrics": models_metrics,
            "target_col": target_col,
            "fitted_model": final_model,
            "last_date": str(series.index[-1]),
            "series_values": series.tolist(),
            "series_dates": [str(d) for d in series.index]
        }

        # Serialize with joblib into bytes
        buffer = io.BytesIO()
        joblib.dump(model_payload, buffer)
        buffer.seek(0)

        object_key = f"forecaster_{self.dataset_id}.joblib"
        storage_service.upload_file(
            bucket_name="models",
            object_name=object_key,
            data=buffer.getvalue(),
            content_type="application/octet-stream"
        )

        # Log to Prometheus
        try:
            from ..monitoring import FORECAST_COUNT
            FORECAST_COUNT.labels(model_type=best_model_name, status="success").inc()
        except Exception:
            pass

        return {
            "dataset_id": self.dataset_id,
            "best_model": best_model_name,
            "best_mape": float(best_mape),
            "all_metrics": models_metrics,
            "historical_len": len(series)
        }
