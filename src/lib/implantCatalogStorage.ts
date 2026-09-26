import bundledCatalogData from "@/data/implantCatalog.json";

// Implant Catalog Storage & Size Lookup Utility
export interface CatalogItem {
  sku?: string;
  description: string;
  size: string;
  price: number;
}

const BUNDLED_CATALOG: CatalogItem[] = (bundledCatalogData as any[]).map((item) => ({
  sku: item.sku || "",
  description: String(item.description || item.product_name || item.name || "").trim(),
  size: String(item.size || item.specification || "").trim(),
  price: Number(item.price || item.rate || item.sell_price) || 0,
})).filter((item) => item.description.length > 0);

// In-memory catalog cache initialized synchronously
let cachedCatalog: CatalogItem[] = BUNDLED_CATALOG;

/**
 * Returns initial catalog synchronously without any fetch latency.
 * Checks localStorage first for custom admin upload, then falls back to bundled catalog.
 */
export function getInitialCatalog(): CatalogItem[] {
  try {
    const stored = typeof window !== "undefined" ? localStorage.getItem("im_price_list") : null;
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const custom = parsed.map((item) => ({
          sku: item.sku || "",
          description: String(item.description || item.product_name || item.name || "").trim(),
          size: String(item.size || item.specification || "").trim(),
          price: Number(item.price || item.rate || item.sell_price) || 0,
        })).filter((item) => item.description.length > 0);
        if (custom.length > 0) {
          cachedCatalog = custom;
          return cachedCatalog;
        }
      }
    }
  } catch (err) {
    console.warn("Failed to parse im_price_list from localStorage:", err);
  }

  return cachedCatalog;
}

/**
 * Loads the complete implant catalog from localStorage (if uploaded in Admin)
 * or bundled catalog.
 */
export async function getImplantCatalog(): Promise<CatalogItem[]> {
  return getInitialCatalog();
}

/**
 * Search unique implant descriptions matching query.
 * If query is empty, returns the top catalog items so users immediately see choices upon clicking the field.
 */
export function searchImplantDescriptions(
  catalog: CatalogItem[],
  query: string,
  limit = 20
): { description: string; samplePrice: number; sizeCount: number; sku?: string }[] {
  const activeCat = catalog && catalog.length > 0 ? catalog : BUNDLED_CATALOG;
  const q = (query || "").trim().toLowerCase();

  const map = new Map<string, { description: string; samplePrice: number; sizes: Set<string>; sku?: string }>();

  for (const item of activeCat) {
    const desc = item.description;
    const sku = item.sku || "";
    const size = item.size || "";

    const matches =
      !q ||
      desc.toLowerCase().includes(q) ||
      (sku && sku.toLowerCase().includes(q)) ||
      (size && size.toLowerCase().includes(q));

    if (matches) {
      const key = desc.toLowerCase().trim();
      if (!map.has(key)) {
        map.set(key, {
          description: desc,
          samplePrice: item.price,
          sizes: new Set<string>(),
          sku: item.sku,
        });
      }
      const entry = map.get(key)!;
      if (item.size) entry.sizes.add(item.size);
      if (item.price > 0 && entry.samplePrice === 0) {
        entry.samplePrice = item.price;
      }
    }

    if (map.size >= (q ? limit : 25)) break;
  }

  return Array.from(map.values())
    .slice(0, limit)
    .map((e) => ({
      description: e.description,
      samplePrice: e.samplePrice,
      sizeCount: e.sizes.size,
      sku: e.sku,
    }));
}

/**
 * Returns all sizes and prices for a given item description.
 * If query is provided, filters sizes matching the query.
 */
export function getSizesForDescription(
  catalog: CatalogItem[],
  itemDescription: string,
  sizeQuery = ""
): { size: string; price: number; sku?: string }[] {
  if (!itemDescription || !itemDescription.trim()) return [];
  const activeCat = catalog && catalog.length > 0 ? catalog : BUNDLED_CATALOG;
  const targetDesc = itemDescription.trim().toLowerCase();
  const q = sizeQuery.trim().toLowerCase();

  // Find all items matching the description (exact or substring)
  let matches = activeCat.filter(
    (item) => item.description.toLowerCase().trim() === targetDesc
  );

  if (matches.length === 0) {
    matches = activeCat.filter((item) => {
      const d = item.description.toLowerCase().trim();
      return d.includes(targetDesc) || targetDesc.includes(d);
    });
  }

  // Filter sizes having non-empty size string
  const sizeMap = new Map<string, { size: string; price: number; sku?: string }>();

  for (const m of matches) {
    const s = m.size.trim();
    if (!s) continue;
    if (q && !s.toLowerCase().includes(q)) continue;

    if (!sizeMap.has(s.toLowerCase())) {
      sizeMap.set(s.toLowerCase(), {
        size: s,
        price: m.price,
        sku: m.sku,
      });
    }
  }

  return Array.from(sizeMap.values());
}

/**
 * Get base price for an item description if catalog has a flat price or fallback.
 */
export function getCatalogItemPrice(
  catalog: CatalogItem[],
  itemDescription: string,
  size = ""
): { price: number; sku?: string } {
  if (!itemDescription || !itemDescription.trim()) return { price: 0 };
  const activeCat = catalog && catalog.length > 0 ? catalog : BUNDLED_CATALOG;
  const targetDesc = itemDescription.trim().toLowerCase();
  const targetSize = (size || "").trim().toLowerCase();

  if (targetSize) {
    const matched = activeCat.find(
      (i) =>
        i.description.toLowerCase().trim() === targetDesc &&
        i.size.toLowerCase().trim() === targetSize
    );
    if (matched) return { price: matched.price, sku: matched.sku };
  }

  const descMatched = activeCat.find(
    (i) => i.description.toLowerCase().trim() === targetDesc && i.price > 0
  );
  if (descMatched) return { price: descMatched.price, sku: descMatched.sku };

  return { price: 0 };
}
