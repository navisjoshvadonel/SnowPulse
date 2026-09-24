## 2024-05-18 - Replacing nested loops in Python with vectorized numpy equivalents
**Learning:** Python nested loops are slow especially for large O(N^2) matrices. Vectorized numpy operations can compute large grids with masks and replaces much faster. E.g., `np.where(np.isnan(corr_matrix), None, corr_matrix).tolist()` to build a list-of-lists of floats or None.
**Action:** Replace explicit Python nested loops with numpy vectorized operations for building multi-dimensional collections like correlation matrices.
