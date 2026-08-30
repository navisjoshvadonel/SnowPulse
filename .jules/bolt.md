## 2024-08-30 - Vectorized Correlation in Pandas/Polars
**Learning:** Sequential 1D `np.corrcoef` calls inside nested loops (O(N^2)) cause massive slowdowns during exploratory data analysis of datasets with many columns.
**Action:** Always compute correlation matrices using a single 2D vectorized `np.corrcoef` call on the entire matrix (e.g., `np.corrcoef(arr, rowvar=False)`), wrapped in `np.atleast_2d` to handle edge cases with single columns, and index the pre-computed matrix to assemble the required output format.
