## 2025-02-28 - Vectorizing N^2 loops in analytics correlations
**Learning:** In purely mathematical Python code generating dense matrices, calculating individual correlations element-by-element in a nested `for` loop causes extreme O(N^2) bottlenecks when column counts grow dynamically (e.g. 50x slowdowns on 500 columns).
**Action:** When calculating statistics over a dynamic set of variables, fully vectorize all scalar conditional logic into matrix form using `np.where`, index masking, and numpy primitives (`atleast_2d`, `isnan`). Never use native python loops to construct numerical matrices.

## 2025-02-28 - JSON Serialization of NumPy Types
**Learning:** Using `np.where(..., None, ...).tolist()` on arrays containing floats creates a NumPy object array where the underlying scalar numbers remain non-native `numpy.float64` objects. This causes `TypeError: Object of type float64 is not JSON serializable` crashes in standard library JSON encoders like FastAPI's default response.
**Action:** To efficiently convert NumPy arrays with NaNs to JSON-serializable Python lists with `None`, avoid `np.where(..., None, ...).tolist()`. Instead, rely on `.tolist()` to natively cast floats, and use a fast list comprehension to handle NaNs: `[[None if np.isnan(v) else v for v in row] for row in matrix.tolist()]`.
