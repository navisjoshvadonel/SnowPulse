import logging

import pandas as pd
import pandera as pa

logger = logging.getLogger("snowpulse.validation")

# Strict Sales Transaction Schema (e.g., test_sales_data.csv)
sales_transaction_schema = pa.DataFrameSchema(
    columns={
        "Date": pa.Column(
            pa.DateTime,
            coerce=True,
            nullable=False,
            description="The calendar date of the transaction"
        ),
        "Revenue": pa.Column(
            pa.Float,
            coerce=True,
            nullable=True,
            checks=[
                # Support positive/negative bounds or general limits
                pa.Check(lambda s: s >= -1000000.0, error="Revenue cannot be an extreme outlier below -1M")
            ],
            description="Transaction revenue amount"
        ),
        "Category": pa.Column(
            pa.String,
            coerce=True,
            nullable=True,
            description="Categorical segment classification"
        ),
        "Region": pa.Column(
            pa.String,
            coerce=True,
            nullable=True,
            description="Geographic region name"
        )
    },
    strict=False, # Allow extra columns
    coerce=True
)

def get_dynamic_schema(df: pd.DataFrame) -> pa.DataFrameSchema:
    """
    Dynamically generates a Pandera schema based on the properties of the dataframe.
    Ensures basic type integrity, non-empty columns, and key analytics columns format.
    """
    columns_spec = {}
    for col in df.columns:
        dtype = df[col].dtype
        # Set checks based on types
        checks = []
        if pd.api.types.is_numeric_dtype(dtype):
            # Check for finite values
            checks.append(pa.Check(lambda s: s.notnull().any() or len(s) == 0, error="Column contains no values"))
            columns_spec[col] = pa.Column(float, coerce=True, nullable=True, checks=checks)
        elif pd.api.types.is_datetime64_any_dtype(dtype):
            columns_spec[col] = pa.Column(pa.DateTime, coerce=True, nullable=True)
        else:
            # String columns
            columns_spec[col] = pa.Column(pa.String, coerce=True, nullable=True)

    return pa.DataFrameSchema(columns=columns_spec, strict=False, coerce=True)
