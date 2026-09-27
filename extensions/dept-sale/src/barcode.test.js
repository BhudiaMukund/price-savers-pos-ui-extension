// Run with: node --test extensions/dept-sale/src/barcode.test.js
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  sameBarcode,
  findByBarcode,
  clearBarcodeCache,
  cachedBarcode,
} from "./barcode.js";

beforeEach(() => clearBarcodeCache());

const balloons = {
  id: 111,
  title: "Balloons 10pk",
  variants: [
    {
      id: 9001,
      barcode: "9312345678901",
      title: "Default Title",
      price: "3.99",
    },
  ],
};
const hat = {
  id: 222,
  title: "Party Hat",
  variants: [
    { id: 9002, barcode: "0012345000011", title: "Red", price: "2.50" },
    { id: 9003, barcode: "0012345000028", title: "Blue", price: "2.50" },
  ],
};

const deviceSearch = (products) => ({
  searchProducts: async () => ({ items: products }),
  fetchProductVariantsWithProductId: async (id) =>
    products.find((p) => p.id === id)?.variantsLater ?? [],
});

const adminReturning =
  (nodes, ok = true) =>
  async () => ({
    ok,
    json: async () => ({ data: { productVariants: { nodes } } }),
  });

test("sameBarcode ignores leading zeros for numeric codes", () => {
  assert.equal(sameBarcode("012345678905", "12345678905"), true);
  assert.equal(sameBarcode("0012345000011", "12345000011"), true);
  assert.equal(sameBarcode("9312345678901", "9312345678902"), false);
  assert.equal(sameBarcode("", "1"), false);
});

test("finds a product on the device by exact barcode", async () => {
  const r = await findByBarcode("9312345678901", {
    productSearch: deviceSearch([balloons]),
  });
  assert.deepEqual(r, {
    variantId: 9001,
    title: "Balloons 10pk",
    price: "3.99",
    source: "device",
  });
});

test("picks the right variant and names it", async () => {
  const r = await findByBarcode("0012345000028", {
    productSearch: deviceSearch([hat]),
  });
  assert.equal(r.variantId, 9003);
  assert.equal(r.title, "Party Hat – Blue");
});

test("ignores search results whose barcode does not match", async () => {
  const r = await findByBarcode("9999999999999", {
    productSearch: deviceSearch([balloons, hat]),
    online: false,
  });
  assert.equal(r, null);
});

test("fetches variants when search results come without them", async () => {
  const noVariants = {
    id: 333,
    title: "Glue Stick",
    variants: [],
    variantsLater: [
      { id: 9010, barcode: "555", title: "Default Title", price: "1.20" },
    ],
  };
  const r = await findByBarcode("555", {
    productSearch: deviceSearch([noVariants]),
  });
  assert.equal(r.variantId, 9010);
});

test("falls back to Shopify when the device finds nothing", async () => {
  const fetchFn = adminReturning([
    {
      legacyResourceId: "4242",
      barcode: "777",
      title: "Default Title",
      displayName: "Streamers",
      price: "1.00",
      product: { title: "Streamers" },
    },
  ]);
  const r = await findByBarcode("777", {
    productSearch: deviceSearch([]),
    fetchFn,
  });
  assert.deepEqual(r, {
    variantId: 4242,
    title: "Streamers",
    price: "1.00",
    source: "shopify",
  });
});

test("does not ask Shopify when offline", async () => {
  let called = false;
  const fetchFn = async () => {
    called = true;
    return { ok: true, json: async () => ({}) };
  };
  const r = await findByBarcode("777", {
    productSearch: deviceSearch([]),
    fetchFn,
    online: false,
  });
  assert.equal(r, null);
  assert.equal(called, false);
});

test("device search error still tries Shopify", async () => {
  const broken = {
    searchProducts: async () => {
      throw new Error("sync");
    },
  };
  const fetchFn = adminReturning([
    {
      legacyResourceId: "1",
      barcode: "777",
      title: "Default Title",
      displayName: "X",
      price: "1.00",
      product: { title: "X" },
    },
  ]);
  const r = await findByBarcode("777", { productSearch: broken, fetchFn });
  assert.equal(r.variantId, 1);
});

test("Shopify permission error returns not found instead of throwing", async () => {
  const r = await findByBarcode("777", {
    productSearch: deviceSearch([]),
    fetchFn: adminReturning([], false),
  });
  assert.equal(r, null);
});

test("empty scan returns null", async () => {
  assert.equal(await findByBarcode("   ", {}), null);
});

test("a repeat scan comes from the cache without searching again", async () => {
  let searches = 0;
  const ps = {
    searchProducts: async () => {
      searches++;
      return { items: [balloons] };
    },
  };
  await findByBarcode("9312345678901", { productSearch: ps, online: false });
  const again = await findByBarcode("09312345678901", {
    productSearch: ps,
    online: false,
  });
  assert.equal(again.variantId, 9001);
  assert.equal(searches, 1);
  assert.equal(cachedBarcode("9312345678901").variantId, 9001);
});

test("Shopify answer wins when the till search is slow", async () => {
  const slow = {
    searchProducts: () =>
      new Promise((r) => setTimeout(() => r({ items: [] }), 300)),
  };
  const fetchFn = adminReturning([
    {
      legacyResourceId: "5",
      barcode: "888",
      title: "Default Title",
      displayName: "Fast",
      price: "2.00",
      product: { title: "Fast" },
    },
  ]);
  const t0 = Date.now();
  const r = await findByBarcode("888", { productSearch: slow, fetchFn });
  assert.equal(r.variantId, 5);
  assert.ok(Date.now() - t0 < 200);
});

test("not found is not cached", async () => {
  await findByBarcode("4444", {
    productSearch: deviceSearch([]),
    online: false,
  });
  assert.equal(cachedBarcode("4444"), null);
});
