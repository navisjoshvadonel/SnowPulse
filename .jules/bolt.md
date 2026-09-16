## 2024-05-24 - Vectorized Correlation Matrix Calculation
**Learning:** In Polars/Numpy, generating correlation matrices via nested `O(N^2)` Python loops across columns is extremely slow. Using the vectorized `np.corrcoef(arr, rowvar=False)` approach processes the entire matrix in C, offering drastic performance improvements (e.g. ~48x speedup).
**Action:** When working with 2D arrays where columns may be dynamic, wrap the output of `np.corrcoef` with `np.atleast_2d()` to ensure 2D bounds and prevent indexing/iteration errors for edge cases like single-column arrays or invalid variances.
