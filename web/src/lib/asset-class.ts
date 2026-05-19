/** Asset class keys aligned with API (symbols.asset_class). */
export type AssetClassKey = "equity" | "etf" | "crypto" | "other"

export const ASSET_CLASS_ORDER: AssetClassKey[] = ["equity", "etf", "crypto", "other"]

export const ASSET_CLASS_LABELS: Record<AssetClassKey, string> = {
  equity: "US Equities",
  etf: "ETFs",
  crypto: "Crypto",
  other: "Other",
}

export function normalizeAssetClass(raw?: string | null): AssetClassKey {
  const v = (raw ?? "equity").toLowerCase()
  if (v === "etf" || v === "crypto" || v === "other") return v
  return "equity"
}

export function groupByAssetClass<T extends { assetClass?: string | null }>(
  items: T[],
): { key: AssetClassKey; label: string; items: T[] }[] {
  const buckets = new Map<AssetClassKey, T[]>()
  for (const item of items) {
    const key = normalizeAssetClass(item.assetClass)
    const list = buckets.get(key) ?? []
    list.push(item)
    buckets.set(key, list)
  }
  return ASSET_CLASS_ORDER.filter((k) => (buckets.get(k)?.length ?? 0) > 0).map((key) => ({
    key,
    label: ASSET_CLASS_LABELS[key],
    items: buckets.get(key) ?? [],
  }))
}
