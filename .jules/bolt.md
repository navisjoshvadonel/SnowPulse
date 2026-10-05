## 2025-02-28 - Vectorizing N^2 loops in analytics correlations
**Learning:** In purely mathematical Python code generating dense matrices, calculating individual correlations element-by-element in a nested `for` loop causes extreme O(N^2) bottlenecks when column counts grow dynamically (e.g. 50x slowdowns on 500 columns).
**Action:** When calculating statistics over a dynamic set of variables, fully vectorize all scalar conditional logic into matrix form using `np.where`, index masking, and numpy primitives (`atleast_2d`, `isnan`). Never use native python loops to construct numerical matrices.

## 2025-03-05 - Avoid .joblib commits during backend testing
**Learning:** Running backend test suites locally often regenerates or modifies binary `.joblib` machine learning model files in local storage, which can accidentally be staged and committed along with code changes.
**Action:** Before submitting a PR or running `git commit`, always run `git status` to ensure binary artifacts like `.joblib` files are not accidentally staged. Use `git restore --staged` and `git checkout` to remove them if they are.
## 2026-10-05 - Vectorized polars group_by aggregation in _score_numeric_categorical
**Learning:** Using a python for loop with `df.filter(...)` inside `_score_numeric_categorical` is an extreme O(N^2) performance bottleneck when iterating through a categorical column's unique values on high-cardinality datasets.
**Action:** Replace for-loop filtering with a single vectorized `group_by` and `agg` operation using polars: `df.select([cat, num]).drop_nulls().group_by(cat).agg(pl.col(num))`, which reduces the complexity to O(N) and significantly speeds up categorical scoring.
