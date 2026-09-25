## 2025-02-28 - Vectorizing N^2 loops in analytics correlations
**Learning:** In purely mathematical Python code generating dense matrices, calculating individual correlations element-by-element in a nested `for` loop causes extreme O(N^2) bottlenecks when column counts grow dynamically (e.g. 50x slowdowns on 500 columns).
**Action:** When calculating statistics over a dynamic set of variables, fully vectorize all scalar conditional logic into matrix form using `np.where`, index masking, and numpy primitives (`atleast_2d`, `isnan`). Never use native python loops to construct numerical matrices.

## 2024-05-18 - Replacing Nested Python Loops with np.where for JSON Serialization
**Learning:** In Polars/Numpy heavy applications, converting `np.ndarray` to Python lists (e.g., for JSON responses) using nested Python `for` loops is surprisingly slow, adding significant overhead when handling missing values (`np.isnan`).
**Action:** When preparing Numpy arrays with NaNs for FastAPI JSON responses, use vectorized substitution via `np.where(np.isnan(matrix), None, matrix).tolist()` instead of explicit nested loops. This approach avoids scalar iteration and leverages underlying C performance.
