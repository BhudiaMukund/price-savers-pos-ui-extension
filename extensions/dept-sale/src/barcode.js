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
    first: 20,
  });
  for (const product of result?.items ?? []) {
    let variants = product.variants;
    if (
      (!variants || variants.length === 0) &&
      productSearch.fetchProductVariantsWithProductId
    ) {
      variants = await productSearch.fetchProductVariantsWithProductId(
        product.id,
      );
    }
    const match = (variants ?? []).find((v) => sameBarcode(v.barcode, code));
    if (match) {
      return {
        variantId: Number(match.id),
        title: describe(match, product),
        price: match.price,
        source: "device",
      };
    }
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

// Returns {variantId, title, price, source} or null if not found anywhere.
export async function findByBarcode(
  code,
  { productSearch, fetchFn, online = true } = {},
) {
  const clean = String(code ?? "").trim();
  if (!clean) return null;
  try {
    const onDevice = await searchOnDevice(clean, productSearch);
    if (onDevice) return onDevice;
  } catch {
    // fall through to Shopify
  }
  if (!online) return null;
  try {
    return await searchAdmin(clean, fetchFn);
  } catch {
    return null;
  }
}
