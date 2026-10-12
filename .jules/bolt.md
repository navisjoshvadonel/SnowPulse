## 2025-02-28 - Vectorizing N^2 loops in analytics correlations
**Learning:** In purely mathematical Python code generating dense matrices, calculating individual correlations element-by-element in a nested `for` loop causes extreme O(N^2) bottlenecks when column counts grow dynamically (e.g. 50x slowdowns on 500 columns).
**Action:** When calculating statistics over a dynamic set of variables, fully vectorize all scalar conditional logic into matrix form using `np.where`, index masking, and numpy primitives (`atleast_2d`, `isnan`). Never use native python loops to construct numerical matrices.

## 2025-03-05 - Avoid .joblib commits during backend testing
**Learning:** Running backend test suites locally often regenerates or modifies binary `.joblib` machine learning model files in local storage, which can accidentally be staged and committed along with code changes.
**Action:** Before submitting a PR or running `git commit`, always run `git status` to ensure binary artifacts like `.joblib` files are not accidentally staged. Use `git restore --staged` and `git checkout` to remove them if they are.
## 2025-03-08 - Replacing O(N^2) Polars Dataframe iteration
**Learning:** Polars `df.filter()` inside a Python loop (e.g. iterating over unique column values to construct groups for ANOVA or other array functions) creates a severe $O(N^2)$ bottleneck on high-cardinality datasets. Iterating over partitions or aggregating via `group_by` is critical.
**Action:** Replace `for val in df[cat].unique().to_list(): df.filter(...)` with vectorized `group_by` and `agg` (e.g., `df.group_by(cat_col).agg(pl.col(num_col))[num_col].to_list()`). This runs in $O(N)$ and allows zero-cost vectorization before converting to numpy arrays.

## 2025-03-08 - Scipy F-Oneway NaN handling
**Learning:** In Scipy, `stats.f_oneway` returns `NaN` if one of the input arrays has zero variance or if the inputs have invalid sample sizes, breaking mathematical ops like `max(0.0, 1 - p_val)`.
**Action:** When computing stats that can return `np.nan` (like `stats.f_oneway`), explicitly check for it with `math.isnan(p_val)` or `np.isnan(p_val)` and return a safe fallback value, rather than relying on Python max/min functions to filter the `NaN` out.
