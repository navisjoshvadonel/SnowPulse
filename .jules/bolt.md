## 2024-10-24 - [Vectorized Numpy Correlation]
**Learning:** O(N^2) double loops calculating pair-wise correlations with `np.corrcoef` iteratively in Python introduces massive overhead compared to a single vectorized `np.corrcoef` call on the entire matrix. This was a critical bottleneck in the `analytics` engines.
**Action:** Always prefer computing complete correlation matrices in a single vectorized NumPy or Polars call over manually nesting loops to process pairs individually.
