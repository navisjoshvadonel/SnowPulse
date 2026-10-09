## 2025-02-28 - Vectorizing N^2 loops in analytics correlations
**Learning:** In purely mathematical Python code generating dense matrices, calculating individual correlations element-by-element in a nested `for` loop causes extreme O(N^2) bottlenecks when column counts grow dynamically (e.g. 50x slowdowns on 500 columns).
**Action:** When calculating statistics over a dynamic set of variables, fully vectorize all scalar conditional logic into matrix form using `np.where`, index masking, and numpy primitives (`atleast_2d`, `isnan`). Never use native python loops to construct numerical matrices.

## 2025-03-05 - Avoid .joblib commits during backend testing
**Learning:** Running backend test suites locally often regenerates or modifies binary `.joblib` machine learning model files in local storage, which can accidentally be staged and committed along with code changes.
**Action:** Before submitting a PR or running `git commit`, always run `git status` to ensure binary artifacts like `.joblib` files are not accidentally staged. Use `git restore --staged` and `git checkout` to remove them if they are.

## 2025-03-05 - Avoid O(N) filters in recursive Polars groupings
**Learning:** Using `sub_df.filter(...)` inside a loop for each unique category causes severe O(N*C) bottlenecks (where C is cardinality).
**Action:** Use Polars' vectorized `partition_by(..., as_dict=True)` before the loop to partition the dataframe once, then look up partitions in O(1) time using `.get((key,))`.
