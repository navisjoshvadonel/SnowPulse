## 2025-02-28 - Vectorizing N^2 loops in analytics correlations
**Learning:** In purely mathematical Python code generating dense matrices, calculating individual correlations element-by-element in a nested `for` loop causes extreme O(N^2) bottlenecks when column counts grow dynamically (e.g. 50x slowdowns on 500 columns).
**Action:** When calculating statistics over a dynamic set of variables, fully vectorize all scalar conditional logic into matrix form using `np.where`, index masking, and numpy primitives (`atleast_2d`, `isnan`). Never use native python loops to construct numerical matrices.

## 2025-03-05 - Avoid .joblib commits during backend testing
**Learning:** Running backend test suites locally often regenerates or modifies binary `.joblib` machine learning model files in local storage, which can accidentally be staged and committed along with code changes.
**Action:** Before submitting a PR or running `git commit`, always run `git status` to ensure binary artifacts like `.joblib` files are not accidentally staged. Use `git restore --staged` and `git checkout` to remove them if they are.
## 2023-10-07 - Vectorized Polars groupby vs Python list comprehensions
**Learning:** Extracting groups via `df.filter(pl.col(cat.name) == val)` inside a Python loop scaling linearly with cardinality leads to severe O(N^2) bottlenecks on high-cardinality data. A simple benchmark simulating 1 million rows with 50,000 cardinality ran in ~56s via a for-loop over `unique()` values, whereas doing `df.group_by().agg(pl.col(...))` and mapping the result executes in ~0.58s.
**Action:** When extracting data sub-slices by category (e.g. computing variance between means for high-cardinality charts), prefer purely vectorized groupings using `df.group_by().agg()` instead of manual looping through `.unique()` filters.
