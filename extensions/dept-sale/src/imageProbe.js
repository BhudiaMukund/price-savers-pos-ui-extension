// Checks which picture keys can actually be loaded, so any key whose image
// fails (offline, slow Wi-Fi, file renamed or missing in Shopify Files)
// falls back to a plain text button.
//
// Shopify's <s-image> doesn't report load errors, so we download each image
// ourselves first:
//   1. A normal request. If the server answers, we can see a 404 (missing file).
//   2. If that's blocked by browser security rules (CORS), an "opaque"
//      request. It can't see 404s, but it still fails when there's no connection,
//      which is the main case we care about.

const TIMEOUT_MS = 4000;

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

export async function probeImage(
  url,
  fetchFn = globalThis.fetch,
  timeoutMs = TIMEOUT_MS,
) {
  if (!url || typeof fetchFn !== "function") return false;
  try {
    const res = await withTimeout(fetchFn(url, { method: "GET" }), timeoutMs);
    return Boolean(res && res.ok);
  } catch (err) {
    if (err && err.message === "timeout") return false;
    // Possibly blocked by CORS rather than a network failure; try opaque.
    try {
      const res = await withTimeout(
        fetchFn(url, { method: "GET", mode: "no-cors" }),
        timeoutMs,
      );
      return Boolean(res) && (res.ok || res.type === "opaque");
    } catch {
      return false;
    }
  }
}

// Returns a Set of department codes whose image FAILED to load.
export async function probeAll(
  codes,
  urlFor,
  fetchFn = globalThis.fetch,
  timeoutMs = TIMEOUT_MS,
) {
  const results = await Promise.all(
    codes.map(async (code) => [
      code,
      await probeImage(urlFor(code), fetchFn, timeoutMs),
    ]),
  );
  return new Set(results.filter(([, ok]) => !ok).map(([code]) => code));
}
