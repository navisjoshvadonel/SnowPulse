## 2025-02-23 - Vectorized correlation matrix generation

**Learning:** When calculating large correlation matrices across dynamic datasets, looping through Numpy `std` arrays and the output of `np.corrcoef` with explicit O(N^2) Python nested `for` loops introduces a substantial performance bottleneck in wide tables. This limits analytics calculation speed and wastes resources.

**Action:** Consistently leverage fully vectorized Numpy masking techniques. Use boolean arrays (e.g. `valid_mask = stds > 1e-12`) to mask out `NaN`s / zero-variance column pairs globally (e.g. `corr_matrix[~valid_mask, :] = 0.0`), applying substitution via `np.where` or direct indexing before converting back to Python structures via `tolist()`. This avoids the massive overhead of scalar python evaluation inside the matrix generation logic.
