import logging

import numpy as np
import pandas as pd
from sklearn.impute import SimpleImputer

logger = logging.getLogger("snowpulse.validation.healer")

class DataHealer:
    @staticmethod
    def auto_heal(df: pd.DataFrame) -> pd.DataFrame:
        """
        Automatically cleans and imputes missing data.
        - Numeric cols: Impute with median, cap outliers at 1st/99th percentile
        - Categorical cols: Impute with most frequent
        """
        df_healed = df.copy()

        # Numeric columns
        num_cols = df_healed.select_dtypes(include=[np.number]).columns
        if len(num_cols) > 0:
            # Impute median
            num_imputer = SimpleImputer(strategy='median')
            df_healed[num_cols] = num_imputer.fit_transform(df_healed[num_cols])

            # Cap outliers (winsorize 1st and 99th percentiles)
            for col in num_cols:
                lower = df_healed[col].quantile(0.01)
                upper = df_healed[col].quantile(0.99)
                df_healed[col] = np.clip(df_healed[col], lower, upper)

        # Categorical columns
        cat_cols = df_healed.select_dtypes(exclude=[np.number, 'datetime', 'datetime64[ns]']).columns
        if len(cat_cols) > 0:
            cat_imputer = SimpleImputer(strategy='most_frequent')
            df_healed[cat_cols] = cat_imputer.fit_transform(df_healed[cat_cols])

        # Remove pure duplicate rows
        df_healed = df_healed.drop_duplicates()

        return df_healed
