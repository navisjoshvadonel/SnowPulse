## 2025-02-28 - Vectorizing N^2 loops in analytics correlations
**Learning:** In purely mathematical Python code generating dense matrices, calculating individual correlations element-by-element in a nested `for` loop causes extreme O(N^2) bottlenecks when column counts grow dynamically (e.g. 50x slowdowns on 500 columns).
**Action:** When calculating statistics over a dynamic set of variables, fully vectorize all scalar conditional logic into matrix form using `np.where`, index masking, and numpy primitives (`atleast_2d`, `isnan`). Never use native python loops to construct numerical matrices.

## 2025-02-28 - Vectorizing N^2 category filtering loops
**Learning:** Using a python `for` loop to filter a polars DataFrame for each unique value of a categorical variable (e.g. `for val in df[cat].unique(): df.filter(...)`) causes extreme O(N^2) bottlenecks when the column has high cardinality (e.g. 1000+ categories). This requires a full DataFrame scan for every single category.
**Action:** When gathering numeric subsets grouped by a categorical variable (like for ANOVA tests), use vectorized polars aggregation (`df.group_by(cat).agg(pl.col(num))`) to extract the grouped arrays in a single O(N) pass, then process the resulting list of series.
