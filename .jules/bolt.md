
## 2024-09-03 - Vectorized Correlation Matrix Calculation
**Learning:** Polars dataframe to numpy conversion inside nested loops to calculate correlations is a severe O(N^2) bottleneck. When converting a Polars DataFrame to a Numpy array for column-specific vectorized operations, explicitly call `.select(columns)` immediately before `.to_numpy()` to guarantee correct column alignment and ordering. Additionally, always wrap `np.corrcoef` with `np.atleast_2d()` when column counts are dynamic to prevent indexing errors on single-column inputs.
**Action:** Replace nested loops calling `np.corrcoef` on 1D arrays with a vectorized 2D approach using `np.corrcoef(arr, rowvar=False)` on the entire 2D array.
