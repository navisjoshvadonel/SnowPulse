## 2026-10-10 - O(N^2) Bottleneck in Polars Dataframe Filtering
**Learning:** In Polars, using `df.filter(pl.col(cat) == val)` inside a for-loop over unique categories is an anti-pattern that leads to severe O(N^2) bottlenecks on high-cardinality datasets, as it scans the entire dataframe for every unique value.
**Action:** Always use vectorized partitioning methods like `df.partition_by(cat_col)` or aggregation methods like `df.group_by(cat_col).agg(...)` to extract groups in a single pass.
