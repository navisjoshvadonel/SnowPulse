
## 2024-05-24 - Vectorize Correlation Matrix Computations
**Learning:** Using nested Python loops over dataframe columns to compute `np.corrcoef` on pairs of 1D arrays results in an $O(N^2)$ bottleneck that completely defeats the purpose of NumPy.
**Action:** Always fully vectorize correlation calculations. Select all columns into a single 2D NumPy array using `df.select(cols).to_numpy().T.astype(float)` and call `np.corrcoef(np.atleast_2d(arr))` to perform the calculation in a single C-level operation. When dealing with dynamic column counts, `np.atleast_2d()` prevents indexing errors on single-column inputs.
