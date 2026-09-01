
## 2024-05-18 - Avoid O(N^2) correlation matrices with Pandas/Polars/Numpy nested loops
**Learning:** Computing correlation matrices by iterating over N columns with nested Python loops and calling `np.corrcoef(col_a, col_b)` repeatedly creates a severe O(N^2) performance bottleneck. On a 100-column dataset, it drops from 0.03s (vectorized) to 2.2s (loops) due to Python overhead and redundant standard deviation calculations. `np.corrcoef` has native support for 2D arrays (using `rowvar=False`) to compute the entire matrix in one vectorized C-level call.
**Action:** Always compute correlation matrices by passing the entire 2D array of selected columns directly to `np.corrcoef(arr, rowvar=False)`, then wrap it in `np.atleast_2d` to handle single-column edge cases cleanly.
