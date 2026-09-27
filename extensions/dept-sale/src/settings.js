// Store-wide Dept Sale settings, edited in Shopify admin under
// Content → Metaobjects → Dept Sale settings. Declared in shopify.app.toml as
// an app-owned metaobject, so no extra permissions are needed.
//
// The admin shows the style as a dropdown of names (see STYLE_CHOICES in
// the toml); this maps those names back to style ids.

import { STYLES } from "./departments.js";

export const SETTINGS_TYPE = "$app:dept_sale_settings";
export const TEXT_ONLY = "text";
const ADMIN_TIMEOUT_MS = 5000;

// Name shown in admin -> style id. "Text keys only" turns pictures off.
export function styleIdFromName(name) {
  const clean = String(name ?? "")
    .trim()
    .toLowerCase();
  if (!clean) return null;
  if (clean === "text keys only") return TEXT_ONLY;
  const match = STYLES.find(
    (s) => s.name.toLowerCase() === clean || s.id === clean,
  );
  return match ? match.id : null;
}

// Returns the style id set in admin, or null if there's no setting yet or
// Shopify can't be reached (the till then keeps what it used last).
export async function fetchStyleSetting(fetchFn) {
  if (typeof fetchFn !== "function") return null;
  const body = {
    query: `query ($type: String!) {
      metaobjects(type: $type, first: 1) {
        nodes { field(key: "key_style") { value } }
      }
    }`,
    variables: { type: SETTINGS_TYPE },
  };
  try {
    const res = await Promise.race([
      fetchFn("shopify:admin/api/graphql.json", {
        method: "POST",
        body: JSON.stringify(body),
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), ADMIN_TIMEOUT_MS),
      ),
    ]);
    if (!res || !res.ok) return null;
    const json = await res.json();
    const value = json?.data?.metaobjects?.nodes?.[0]?.field?.value;
    return styleIdFromName(value);
  } catch {
    return null;
  }
}
