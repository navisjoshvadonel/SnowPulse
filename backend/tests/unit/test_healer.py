import numpy as np
import pandas as pd
from app.validation.quality.healer import DataHealer


def test_data_healer_auto_heal():
    # Construct a noisy dataframe with missing values, extreme outliers, and duplicates
    df = pd.DataFrame({
        "numeric_val": [10.0, 12.0, np.nan, 14.0, 1000.0, 10.0],
        "category_val": ["A", "A", np.nan, "B", "A", "A"]
    })

    healed_df = DataHealer.auto_heal(df)

    # 1. Missing values filled
    assert healed_df["numeric_val"].isna().sum() == 0
    assert healed_df["category_val"].isna().sum() == 0

    # 2. Duplicate row removed (index 5 is duplicate of index 0)
    assert len(healed_df) < len(df)
