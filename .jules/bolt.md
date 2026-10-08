## 2025-02-28 - Vectorizing N^2 loops in analytics correlations
**Learning:** In purely mathematical Python code generating dense matrices, calculating individual correlations element-by-element in a nested `for` loop causes extreme O(N^2) bottlenecks when column counts grow dynamically (e.g. 50x slowdowns on 500 columns).
**Action:** When calculating statistics over a dynamic set of variables, fully vectorize all scalar conditional logic into matrix form using `np.where`, index masking, and numpy primitives (`atleast_2d`, `isnan`). Never use native python loops to construct numerical matrices.

## 2025-03-05 - Avoid .joblib commits during backend testing
**Learning:** Running backend test suites locally often regenerates or modifies binary `.joblib` machine learning model files in local storage, which can accidentally be staged and committed along with code changes.
**Action:** Before submitting a PR or running `git commit`, always run `git status` to ensure binary artifacts like `.joblib` files are not accidentally staged. Use `git restore --staged` and `git checkout` to remove them if they are.

## 2026-10-08 - Use float32 dot products for boolean co-occurrences
**Learning:** When calculating pairwise missingness (or boolean AND co-occurrences) across hundreds of columns, nested Python `np.sum(mask_a & mask_b)` loops execute in O(N^2) resulting in 15+ second bottlenecks on standard datasets. While native `numpy` boolean array evaluation is somewhat faster, converting the boolean masks to `float32` and utilizing `np.dot(matrix, matrix.T)` delegates the task to highly optimized C/BLAS routines resulting in near instantaneous execution (~0.04s).
**Action:** When calculating co-occurrence across many boolean arrays, use `mask_matrix = np.array([...], dtype=np.float32)` and compute intersection pairs with `np.dot(mask_matrix, mask_matrix.T)` rather than looping explicitly.

## 2026-10-08 - Vectorize correlation scanning using triu_indices
**Learning:** Iterating linearly over an entire NxN NumPy correlation matrix within Python to detect strong positive/negative signals creates a large, slow loop when testing 500+ metrics.
**Action:** Extract only the upper triangle of pairwise correlation indices using `np.triu_indices`, apply vectorized boolean masking (`valid_mask = np.abs(r_vals) >= 0.8`), and iterate over only the filtered arrays instead of native loops.
