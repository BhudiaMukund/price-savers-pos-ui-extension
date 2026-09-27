// Barcode lookup for scans made while Dept Sale is open.
//
// POS doesn't add scanned items to the cart while an extension screen is
// showing, so Dept Sale receives the scan itself and finds the product:
//   1. Products stored on this till (fast, works offline). Can miss items on
//      big catalogues or if the till hasn't synced recently.
//   2. Shopify directly (reliable, needs internet and the read_products
//      permission). Used only when step 1 finds nothing.
//
// Everything Shopify-specific is passed in, so this file can be unit-tested.

const ADMIN_TIMEOUT_MS = 5000;
const CACHE_MS = 30 * 60 * 1000;

// Barcodes found recently, so scanning the same product again is instant.
// Kept while POS keeps the extension loaded.
const cache = new Map();
export function clearBarcodeCache() {
  cache.clear();
}
const cacheKey = (code) =>
  /^\d+$/.test(code) ? code.replace(/^0+/, "") : code.toLowerCase();

// Barcodes can arrive with or without leading zeros (UPC-A 12 digits vs
// EAN-13 with a leading 0), so compare numeric codes without them.
export function sameBarcode(a, b) {
  if (!a || !b) return false;
  const x = String(a).trim();
  const y = String(b).trim();
  if (x === y) return true;
  if (/^\d+$/.test(x) && /^\d+$/.test(y)) {
    return x.replace(/^0+/, "") === y.replace(/^0+/, "");
  }
  return x.toLowerCase() === y.toLowerCase();
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

function describe(variant, product) {
  const productTitle = product?.title ?? variant?.product?.title ?? "";
  const variantTitle =
    variant?.title && variant.title !== "Default Title" ? variant.title : "";
  return (
    variant?.displayName ||
    [productTitle, variantTitle].filter(Boolean).join(" – ") ||
    "Item"
  );
}

// Step 1: this till's product search.
export async function searchOnDevice(code, productSearch) {
  if (!productSearch?.searchProducts) return null;
  const result = await productSearch.searchProducts({
    queryString: code,
    first: 10,
  });
  const items = result?.items ?? [];
  const hit = (variants, product) => {
    const match = (variants ?? []).find((v) => sameBarcode(v.barcode, code));
    return match
      ? {
          variantId: Number(match.id),
          title: describe(match, product),
          price: match.price,
          source: "device",
        }
      : null;
  };
  // Check the variants that came with the results first (no extra calls).
  for (const product of items) {
    const found = hit(product.variants, product);
    if (found) return found;
  }
  // Then fetch variants for any results that came without them, all at once.
  if (!productSearch.fetchProductVariantsWithProductId) return null;
  const missing = items.filter((p) => !p.variants || p.variants.length === 0);
  const fetched = await Promise.all(
    missing.map((p) =>
      productSearch.fetchProductVariantsWithProductId(p.id).catch(() => []),
    ),
  );
  for (let i = 0; i < missing.length; i++) {
    const found = hit(fetched[i], missing[i]);
    if (found) return found;
  }
  return null;
}

// Step 2: ask Shopify (Admin GraphQL). Needs the read_products scope.
export async function searchAdmin(code, fetchFn) {
  if (typeof fetchFn !== "function") return null;
  const safe = String(code).replace(/["\\]/g, "");
  const body = {
    query: `query ($q: String!) {
      productVariants(first: 5, query: $q) {
        nodes { legacyResourceId barcode title displayName price product { title } }
      }
    }`,
    variables: { q: `barcode:"${safe}"` },
  };
  const res = await withTimeout(
    fetchFn("shopify:admin/api/graphql.json", {
      method: "POST",
      body: JSON.stringify(body),
    }),
    ADMIN_TIMEOUT_MS,
  );
  if (!res || !res.ok) return null;
  const json = await res.json();
  const nodes = json?.data?.productVariants?.nodes ?? [];
  const match = nodes.find((v) => sameBarcode(v.barcode, code));
  if (!match) return null;
  return {
    variantId: Number(match.legacyResourceId),
    title: describe(match, match.product),
    price: match.price,
    source: "shopify",
  };
}

// Resolves with the first non-null result, or null once all are done.
function firstFound(promises) {
  return new Promise((resolve) => {
    let left = promises.length;
    if (left === 0) resolve(null);
    for (const p of promises) {
      p.then(
        (v) => {
          if (v) resolve(v);
          else if (--left === 0) resolve(null);
        },
        () => {
          if (--left === 0) resolve(null);
        },
      );
    }
  });
}

// Returns {variantId, title, price, source} or null if not found anywhere.
// The till and Shopify are asked at the same time and the first match wins,
// so a slow till search doesn't hold up a scan.
export async function findByBarcode(
  code,
  { productSearch, fetchFn, online = true } = {},
) {
  const clean = String(code ?? "").trim();
  if (!clean) return null;
  const key = cacheKey(clean);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.result;

  const lookups = [
    Promise.resolve().then(() => searchOnDevice(clean, productSearch)),
  ];
  if (online)
    lookups.push(Promise.resolve().then(() => searchAdmin(clean, fetchFn)));
  const result = await firstFound(lookups);
  if (result) cache.set(key, { at: Date.now(), result });
  return result;
}

// Instant answer for a barcode scanned recently, without searching.
export function cachedBarcode(code) {
  const hit = cache.get(cacheKey(String(code ?? "").trim()));
  return hit && Date.now() - hit.at < CACHE_MS ? hit.result : null;
}
