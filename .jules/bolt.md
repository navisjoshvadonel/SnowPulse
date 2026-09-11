## 2024-05-18 - Optimize Correlation Matrix
**Learning:** In Polars/Pandas analytics pipelines, converting column-by-column iteration of `np.corrcoef` into a fully vectorized 2D array matrix operation `np.corrcoef(arr, rowvar=False)` dramatically speeds up profiling, transforming O(N^2) overhead into a single optimized C-level call.
**Action:** Always extract the full multi-column `np.ndarray` and calculate correlation matrices in bulk, selecting columns right before conversion to ensure proper alignment.
