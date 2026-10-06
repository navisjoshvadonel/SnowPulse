## 2025-02-28 - Vectorizing N^2 loops in analytics correlations
**Learning:** In purely mathematical Python code generating dense matrices, calculating individual correlations element-by-element in a nested `for` loop causes extreme O(N^2) bottlenecks when column counts grow dynamically (e.g. 50x slowdowns on 500 columns).
**Action:** When calculating statistics over a dynamic set of variables, fully vectorize all scalar conditional logic into matrix form using `np.where`, index masking, and numpy primitives (`atleast_2d`, `isnan`). Never use native python loops to construct numerical matrices.

## 2025-03-05 - Avoid .joblib commits during backend testing
**Learning:** Running backend test suites locally often regenerates or modifies binary `.joblib` machine learning model files in local storage, which can accidentally be staged and committed along with code changes.
**Action:** Before submitting a PR or running `git commit`, always run `git status` to ensure binary artifacts like `.joblib` files are not accidentally staged. Use `git restore --staged` and `git checkout` to remove them if they are.

## 2026-10-06 - Type mismatch in Polars group_by List series
**Learning:** When using `df.group_by(cat).agg(pl.col(num))` in Polars to extract groups, iterating over the aggregated column yields Polars `Series` objects in newer Polars versions (or native lists in some legacy configurations). Calling `.to_numpy()` on the iterator output can lead to an `AttributeError` if the element resolves to a python `list`. Using `np.array(s)` instead of `s.to_numpy()` safely handles both Polars Series and native Python list extraction.
**Action:** Always use `np.array(s)` when converting aggregated group iterables to numpy arrays to ensure safety against type variations in Polars aggregation outputs.
