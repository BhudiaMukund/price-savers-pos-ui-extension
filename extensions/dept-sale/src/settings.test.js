// Run with: node --test extensions/dept-sale/src/settings.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { styleIdFromName, fetchStyleSetting, TEXT_ONLY } from "./settings.js";

const answering =
  (value, ok = true) =>
  async () => ({
    ok,
    json: async () => ({
      data: {
        metaobjects: {
          nodes: value === undefined ? [] : [{ field: { value } }],
        },
      },
    }),
  });

test("maps admin names to style ids", () => {
  assert.equal(styleIdFromName("Product icons"), "icons");
  assert.equal(styleIdFromName(" classic casio "), "classic");
  assert.equal(styleIdFromName("Text keys only"), TEXT_ONLY);
  assert.equal(styleIdFromName("Rainbow"), null);
  assert.equal(styleIdFromName(""), null);
});

test("reads the style from the settings entry", async () => {
  assert.equal(
    await fetchStyleSetting(answering("Dark with colour bar")),
    "dark",
  );
});

test("no settings entry yet gives null", async () => {
  assert.equal(await fetchStyleSetting(answering(undefined)), null);
});

test("errors and missing fetch give null", async () => {
  assert.equal(await fetchStyleSetting(answering("Bold colour", false)), null);
  assert.equal(
    await fetchStyleSetting(async () => {
      throw new Error("offline");
    }),
    null,
  );
  assert.equal(await fetchStyleSetting(undefined), null);
});
