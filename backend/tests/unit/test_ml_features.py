import numpy as np
import pandas as pd

from app.ml.features import FeaturePipeline


def test_feature_pipeline_numeric():
    fp = FeaturePipeline(use_robust_scaler=False)
    df = pd.DataFrame({"num1": [1.0, 2.0, np.nan, 4.0]})
    res_fit = fp.fit_transform_numeric(df, ["num1"])
    assert res_fit.shape == (4, 1)

    res_trans = fp.transform_numeric(df, ["num1"])
    assert res_trans.shape == (4, 1)

    assert fp.fit_transform_numeric(df, []).shape == (4, 0)
    assert fp.transform_numeric(df, []).shape == (4, 0)


def test_feature_pipeline_categorical():
    fp = FeaturePipeline()
    df = pd.DataFrame({"cat1": ["a", "b", "a", np.nan]})
    res_fit = fp.fit_transform_categorical(df, ["cat1"])
    assert res_fit.shape == (4, 1)

    res_trans = fp.transform_categorical(df, ["cat1"])
    assert res_trans.shape == (4, 1)

    assert fp.fit_transform_categorical(df, []).shape == (4, 0)
    assert fp.transform_categorical(df, []).shape == (4, 0)


def test_feature_pipeline_datetime_and_text_and_lags():
    fp = FeaturePipeline()
    df = pd.DataFrame({
        "dt1": ["2025-01-01", "2025-01-02", "2025-01-03", "2025-01-04"],
        "txt1": ["hello world", "test data", "hello again", "world test"]
    })
    res_dt, names_dt = fp.fit_transform_datetime(df, ["dt1"])
    assert res_dt.shape[0] == 4
    assert len(names_dt) > 0

    res_dt_tr, _ = fp.transform_datetime(df, ["dt1"])
    assert res_dt_tr.shape[0] == 4

    res_txt, names_txt = fp.fit_transform_text(df, ["txt1"])
    assert res_txt.shape[0] == 4
    assert len(names_txt) > 0

    res_txt_tr, _ = fp.transform_text(df, ["txt1"])
    assert res_txt_tr.shape[0] == 4

    # Lags
    lags_df = FeaturePipeline.create_lag_features(pd.Series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], name="val"))
    assert not lags_df.empty
