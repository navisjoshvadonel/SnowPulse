export interface FormatOptions {
  notation?: "standard" | "compact";
  maximumFractionDigits?: number;
  semanticType?: string | null;
}

/**
 * Dynamically formats numeric metric values based on column name, semantic type, or inferred role.
 * Prevents hardcoding '$' on non-financial metrics (e.g. Satisfaction Score, Count, Temperature, Age).
 */
export function formatMetricValue(
  val: number | null | undefined,
  metricName?: string | null,
  semanticType?: string | null,
  options: FormatOptions = {}
): string {
  if (val === null || val === undefined || isNaN(val)) return "N/A";

  const name = (metricName || "").toLowerCase();
  const sem = (semanticType || "").toLowerCase();

  // 1. Explicit or Inferred Currency
  const isCurrencySem = ["currency", "monetary", "usd", "eur", "gbp", "price", "revenue", "financial"].some((s) => sem.includes(s));
  const isCurrencyName = ["revenue", "sales", "price", "amount", "cost", "profit", "spend", "mrr", "arr", "income", "salary", "dollar", "usd", "eur", "fee", "tax", "margin"].some((k) => name.includes(k));
  
  // Non-currency name overrides
  const isNonCurrencyName = ["score", "rating", "count", "age", "length", "width", "height", "temp", "weight", "depth", "index", "density", "ratio", "units", "id", "row", "pct", "percent", "quantity"].some((k) => name.includes(k));

  const isCurrency = (isCurrencySem || isCurrencyName) && !isNonCurrencyName && sem !== "percentage" && sem !== "count";

  // 2. Explicit or Inferred Percentage
  const isPercentage = sem.includes("percent") || sem.includes("pct") || sem.includes("ratio") || name.includes("pct") || name.includes("percent") || name.includes("rate") || name.includes("margin_pct");

  const notation = options.notation || "standard";
  const maxDigits = options.maximumFractionDigits !== undefined ? options.maximumFractionDigits : (isCurrency ? 2 : 1);

  if (isCurrency) {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        notation,
        compactDisplay: "short",
        maximumFractionDigits: notation === "compact" ? 1 : maxDigits,
      }).format(val);
    } catch {
      return `$${val.toFixed(maxDigits)}`;
    }
  }

  if (isPercentage) {
    const pctVal = val > 1 && val <= 100 ? val : val * 100;
    return `${pctVal.toFixed(1)}%`;
  }

  if (notation === "compact") {
    if (Math.abs(val) >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
    if (Math.abs(val) >= 1_000) return `${(val / 1_000).toFixed(1)}k`;
    return Number.isInteger(val) ? String(val) : val.toFixed(maxDigits);
  }

  return Number.isInteger(val)
    ? new Intl.NumberFormat("en-US").format(val)
    : new Intl.NumberFormat("en-US", { maximumFractionDigits: maxDigits }).format(val);
}
