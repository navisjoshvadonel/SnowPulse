## 2024-08-29 - [Vectorized Correlation Matrix Optimization]
**Learning:** Using explicit Python nested loops to calculate correlations pairwise across numeric columns results in an O(N^2) bottleneck for datasets with many columns.
**Action:** Always prefer fully vectorized operations like `np.corrcoef` on a 2D array, and ensure to wrap the output with `np.atleast_2d()` to avoid indexing errors with a single column.
