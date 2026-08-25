## 2024-08-25 - np.corrcoef returns scalar for 1D input
**Learning:** `np.corrcoef(arr, rowvar=False)` returns a 0D scalar float (e.g., `1.0`) instead of a 2D array if the input `arr` has only 1 column. This causes `IndexError` when subsequent code tries to index it as `corr_matrix[i, j]`.
**Action:** Always wrap `np.corrcoef` with `np.atleast_2d()` when replacing nested loops on dynamically sized arrays.
