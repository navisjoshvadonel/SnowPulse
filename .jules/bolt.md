## 2025-02-28 - Vectorizing N^2 loops in analytics correlations
**Learning:** In purely mathematical Python code generating dense matrices, calculating individual correlations element-by-element in a nested `for` loop causes extreme O(N^2) bottlenecks when column counts grow dynamically (e.g. 50x slowdowns on 500 columns).
**Action:** When calculating statistics over a dynamic set of variables, fully vectorize all scalar conditional logic into matrix form using `np.where`, index masking, and numpy primitives (`atleast_2d`, `isnan`). Never use native python loops to construct numerical matrices.

## 2024-06-11 - Vectorized List Construction in Profiler
**Learning:** In backend analytics, building a correlation matrix line-by-line via explicit nested Python loops introduces a severe O(N^2) bottleneck. NumPy's `np.where()` is vastly faster (~16x speedup) for creating lists with conditional missing values (`None`) suitable for JSON serialization.
**Action:** When converting Numpy arrays with NaNs into Python lists containing `None` for FastAPI responses or standard models, prefer `np.where(np.isnan(matrix), None, matrix).tolist()` over explicit loops. Add `# type: ignore` to the assignment to appease MyPy type checkers which fail to resolve the overload variant on generic list return types.
