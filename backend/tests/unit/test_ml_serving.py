from unittest.mock import MagicMock

import numpy as np
import pytest
from app.ml.serving import MLServing


def test_ml_serving_not_loaded():
    ms = MLServing(999, "classification")
    ms.loaded = False
    with pytest.raises(RuntimeError):
        ms.predict([{"a": 1}])


def test_ml_serving_format_predictions():
    ms = MLServing(1, "regression")
    ms.pipeline = {"target_col": "target"}
    mock_estimator = MagicMock()
    mock_estimator.predict.return_value = np.array([10.5, 20.0])

    res = ms._format_predictions(np.array([[1], [2]]), mock_estimator)
    assert res["task_type"] == "regression"
    assert len(res["predictions"]) == 2
    assert res["predictions"][0]["predicted_value"] == 10.5

    ms.task_type = "classification"
    mock_estimator.predict.return_value = np.array(["cat", "dog"])
    mock_estimator.predict_proba.return_value = np.array([[0.1, 0.9], [0.8, 0.2]])

    res_cls = ms._format_predictions(np.array([[1], [2]]), mock_estimator)
    assert res_cls["task_type"] == "classification"
    assert res_cls["predictions"][0]["predicted_class"] == "cat"
    assert res_cls["predictions"][0]["confidence"] == 0.9


def test_ml_serving_predict():
    ms = MLServing(1, "regression")
    ms.loaded = True
    mock_preprocessor = MagicMock()
    mock_preprocessor.transform.return_value = np.array([[1.0], [2.0]])
    mock_estimator = MagicMock()
    mock_estimator.predict.return_value = np.array([5.0, 10.0])

    ms.pipeline = {
        "preprocessor": mock_preprocessor,
        "estimator": mock_estimator,
        "original_features": ["feat1"],
        "target_col": "target",
    }

    res = ms.predict([{"feat1": 1.0}, {"feat1": 2.0}])
    assert res["task_type"] == "regression"
    assert len(res["predictions"]) == 2
