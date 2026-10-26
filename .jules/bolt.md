## 2025-02-28 - Vectorizing N^2 loops in analytics correlations
**Learning:** In purely mathematical Python code generating dense matrices, calculating individual correlations element-by-element in a nested `for` loop causes extreme O(N^2) bottlenecks when column counts grow dynamically (e.g. 50x slowdowns on 500 columns).
**Action:** When calculating statistics over a dynamic set of variables, fully vectorize all scalar conditional logic into matrix form using `np.where`, index masking, and numpy primitives (`atleast_2d`, `isnan`). Never use native python loops to construct numerical matrices.

## 2025-03-05 - Avoid .joblib commits during backend testing
**Learning:** Running backend test suites locally often regenerates or modifies binary `.joblib` machine learning model files in local storage, which can accidentally be staged and committed along with code changes.
**Action:** Before submitting a PR or running `git commit`, always run `git status` to ensure binary artifacts like `.joblib` files are not accidentally staged. Use `git restore --staged` and `git checkout` to remove them if they are.
## 2025-03-05 - Avoid O(N^2) Polars Iteration
**Learning:** Polars dataframes should never be manually iterated over using `.filter(pl.col(dim) == value)` inside a Python loop if looping through groups (which causes extreme N^2 algorithmic complexity on categorical columns).
**Action:** Use `.partition_by(dim)` to vectorize group extraction, returning an iterable of partitioned dataframes dynamically in a single pass (O(N)), leading to 10x+ algorithmic speedups.

## 2025-03-05 - Optimize React component re-renders by memoizing derived arrays
**Learning:** Recomputing derived arrays (like using `.filter()` and `.map()`) dynamically in the body of a frequently re-rendering React component creates new array references every render. When passed down as props, this defeats child component memoization and causes heavy charts to pointlessly re-render or re-run `useEffect` logic. Also, hooks must always be placed before any conditional early returns.
**Action:** Wrap any non-trivial derived state objects or arrays in `useMemo` hooks with strict dependencies (e.g. `schemaData`) to preserve referential equality across standard re-renders, and ensure hooks are at the top level of the component.
