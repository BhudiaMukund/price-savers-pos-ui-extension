import { render } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";

import {
  DEPARTMENT_ROWS,
  LAYOUT,
  DEPT_PROPERTY_KEY,
  KEY_IMAGES,
  STYLES,
  DEFAULT_STYLE,
  getStyle,
  keyImageUrl,
  numImageUrl,
  previewImageUrl,
} from "./departments.js";
import { initialState, press, formatCents } from "./keypad.js";
import { probeAll } from "./imageProbe.js";
import { findByBarcode, cachedBarcode } from "./barcode.js";

export default async () => {
  render(<DeptSale />, document.body);
};

const DEPTS_BY_CODE = Object.fromEntries(
  DEPARTMENT_ROWS.flat().map((d) => [d.code, d]),
);

// C sits on its own full-width row at the bottom of the number pad.
const NUM_ROWS = [
  ["7", "8", "9"],
  ["4", "5", "6"],
  ["1", "2", "3"],
  ["0", "00", "X"],
  ["C"],
];

// Every picture key: departments by code, number keys as NUM:<key>.
const ALL_CODES = [
  ...DEPARTMENT_ROWS.flat().map((d) => d.code),
  ...NUM_ROWS.flat().map((k) => `NUM:${k}`),
];
const imageFor = (styleId) => (code) =>
  code.startsWith("NUM:")
    ? numImageUrl(code.slice(4), styleId)
    : keyImageUrl(code, styleId);

const px = (n) => `${Math.round(n)}px`;

// Visual feedback (POS extensions can't vibrate or play sounds).
const STATUS_MS = 2500; // how long the green/red status pill stays before going back to plain text

const STYLE_STORAGE_KEY = "keyStyle";

// POS can replay the last scan when a screen subscribes to the scanner.
// A scan identical to that one arriving this soon after opening is ignored.
const STALE_SCAN_MS = 600;

// Results of the last picture check per style, kept while POS keeps the
// extension loaded so reopening Dept Sale doesn't flash text keys first.
const lastFailed = {};
let lastStyle = null;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// How many of this custom sale (same title and price) are in the cart right now,
// and which line holds them. Used to double-check an add that POS reported as failed.
function cartCount(title, cents) {
  const lines = shopify.cart.current.value?.lineItems ?? [];
  let qty = 0;
  let uuid;
  for (const l of lines) {
    if (
      l.productId == null &&
      l.title === title &&
      Math.round(Number(l.price) * 100) === cents
    ) {
      qty += l.quantity ?? 0;
      uuid = l.uuid;
    }
  }
  return { qty, uuid };
}

// POS sometimes reports an error even though the item did go into the cart
// (seen when a repeat merges into an existing line). Check the cart a few times
// before telling staff it failed.
async function landedInCart(title, cents, qtyBefore, qty) {
  for (let i = 0; i < 4; i++) {
    await wait(250);
    const now = cartCount(title, cents);
    if (now.qty >= qtyBefore + qty) return now;
  }
  return null;
}

function isOnline(state) {
  // If POS can't tell us, assume online.
  return state?.internetConnected !== "Disconnected";
}

function DeptSale() {
  const [pad, setPad] = useState(initialState);
  const [added, setAdded] = useState([]); // lines added in this session, newest first
  const [cartTotal, setCartTotal] = useState(
    readTotal(shopify.cart.current.value),
  );
  const [isTablet, setIsTablet] = useState(false); // start with the phone layout; it fits everywhere
  const [online, setOnline] = useState(
    isOnline(shopify.connectivity?.current?.value),
  );
  const [style, setStyle] = useState(lastStyle ?? DEFAULT_STYLE);
  const [showStyles, setShowStyles] = useState(false);
  // Keys whose picture couldn't be loaded in the current style; those show as text.
  const [failed, setFailed] = useState(lastFailed[style] ?? new Set());
  // Some styles (Product icons) are too detailed for a phone's tiny keys, so a
  // phone shows that style's `phoneStyle` instead. The choice itself is kept.
  const activeStyle = isTablet ? style : (getStyle(style).phoneStyle ?? style);
  // The keypad state also lives in a ref so key handlers never go stale and the
  // key grids can be drawn once instead of on every tap (much faster in POS).
  const padRef = useRef(initialState);
  // Items are added to the cart one after another in the background, so staff
  // can keep typing while POS saves the previous one.
  const queue = useRef(Promise.resolve());
  const addedRef = useRef([]); // same as `added`, readable immediately inside the queue
  const [status, setStatus] = useState(null); // {tone, text} shown as a coloured pill
  // A problem staff must not miss (barcode not found, item not added). The scan
  // beep is the same either way, so this stays up until dismissed or the next
  // item goes in, instead of fading like the pill.
  const [alert, setAlert] = useState(null);
  const onlineRef = useRef(online);
  onlineRef.current = online;
  const timers = useRef({});

  function later(name, ms, fn) {
    clearTimeout(timers.current[name]);
    timers.current[name] = setTimeout(fn, ms);
  }
  function showStatus(tone, text) {
    setStatus({ tone, text });
    later("status", STATUS_MS, () => setStatus(null));
    if (tone === "success") setAlert(null);
  }
  function showAlert(heading) {
    clearTimeout(timers.current.status);
    setStatus(null);
    setAlert(heading);
  }
  useEffect(
    () => () => Object.values(timers.current).forEach(clearTimeout),
    [],
  );

  // The list behind Undo. Entries go in as soon as staff tap, and come out
  // again if POS couldn't add them.
  function remember(entry) {
    addedRef.current = [entry, ...addedRef.current].slice(0, 20);
    setAdded(addedRef.current);
  }
  function forget(entry) {
    entry.failed = true;
    addedRef.current = addedRef.current.filter((a) => a !== entry);
    setAdded(addedRef.current);
  }

  useEffect(() => {
    const unsubs = [];
    unsubs.push(
      shopify.cart.current.subscribe((cart) => setCartTotal(readTotal(cart))),
    );
    if (shopify.connectivity?.current?.subscribe) {
      unsubs.push(
        shopify.connectivity.current.subscribe((state) =>
          setOnline(isOnline(state)),
        ),
      );
    }
    shopify.device
      .isTablet()
      .then((tablet) => setIsTablet(Boolean(tablet)))
      .catch(() => {});
    // This till's saved style (works offline).
    Promise.resolve(shopify.storage?.get?.(STYLE_STORAGE_KEY))
      .then((saved) => {
        if (saved && STYLES.some((s) => s.id === saved)) {
          lastStyle = saved;
          setStyle(saved);
        }
      })
      .catch(() => {});
    return () => unsubs.forEach((u) => u && u());
  }, []);

  // Check the pictures on open, when the style changes, and when the internet comes back.
  useEffect(() => {
    setFailed(lastFailed[activeStyle] ?? new Set());
    if (!KEY_IMAGES.baseUrl || !online) return;
    let cancelled = false;
    probeAll(ALL_CODES, imageFor(activeStyle))
      .then((bad) => {
        lastFailed[activeStyle] = bad;
        if (!cancelled) setFailed(bad);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [online, activeStyle]);

  function chooseStyle(id) {
    lastStyle = id;
    setStyle(id);
    setShowStyles(false);
    Promise.resolve(shopify.storage?.set?.(STYLE_STORAGE_KEY, id)).catch(
      () => {},
    );
    shopify.toast.show(`Style: ${getStyle(id).name}`);
  }

  const L = isTablet ? LAYOUT.tablet : LAYOUT.phone;
  // Clear spans exactly three number keys plus the two gaps between them.
  const clearWidth = px(L.numKey * 3 + L.gapPx * 2);
  const picturesAvailable = Boolean(KEY_IMAGES.baseUrl);
  // A key shows its picture only if pictures are set up, we're online, and
  // that key's image loaded in the last check. Otherwise it's a text button.
  const showPicture = (code) =>
    picturesAvailable && online && !failed.has(code);

  function updatePad(next) {
    padRef.current = next;
    setPad(next);
  }

  function onKey(key) {
    const result = press(padRef.current, key);
    updatePad(result.state);
    if (result.error) {
      showStatus("critical", result.error);
      shopify.toast.show(result.error);
      return;
    }
    if (!result.sale) return;

    const { code, cents, qty } = result.sale;
    const dept = DEPTS_BY_CODE[code];
    const text = `${qty} × $${formatCents(cents)} ${dept.title}`;
    // Show it straight away. POS takes a moment to confirm, and failures are
    // rare, so the pill only changes again if the add really fails.
    const entry = {
      kind: "dept",
      uuid: undefined,
      code,
      title: dept.title,
      cents,
      qty,
      taxable: dept.taxable,
    };
    remember(entry);
    showStatus("success", `✓ ${text}`);
    queue.current = queue.current.then(async () => {
      let uuid;
      const before = cartCount(dept.title, cents);
      try {
        uuid = await shopify.cart.addCustomSale({
          title: dept.title,
          price: formatCents(cents),
          quantity: qty,
          taxable: dept.taxable,
        });
      } catch (err) {
        // Believe the cart, not the error: if the quantity went up, it was added.
        const landed = await landedInCart(dept.title, cents, before.qty, qty);
        if (!landed) {
          forget(entry);
          showAlert(`Not added: ${text}. Key it again.`);
          shopify.toast.show(
            `Couldn't add ${text} (${err?.message ?? "unknown error"}). Please key it again.`,
          );
          return;
        }
        uuid = landed.uuid;
      }

      entry.uuid = uuid;

      // Tag the line with its department for reporting. Kept completely separate:
      // if tagging fails (e.g. POS merged a repeat into an existing line), the
      // sale is still in the cart, so staff see nothing.
      if (uuid) {
        Promise.resolve()
          .then(() =>
            shopify.cart.addLineItemProperties(uuid, {
              [DEPT_PROPERTY_KEY]: code,
            }),
          )
          .catch(() => {});
      }
    });
  }

  // A barcode scanned while Dept Sale is open. POS doesn't add it to the cart
  // itself while this screen is showing, so look the product up and add it.
  // A quantity typed with × first applies to the scan (3 × scan = 3 of it).
  function onScan(code) {
    const qty = padRef.current.qty > 1 ? padRef.current.qty : 1;
    if (qty > 1) updatePad({ ...padRef.current, qty: 1 });
    const describe = (found) => {
      const cents = Math.round(Number(found.price ?? 0) * 100);
      return {
        cents,
        text: `${qty} × ${found.title}${found.price != null ? ` $${formatCents(cents)}` : ""}`,
      };
    };
    // Start looking straight away, alongside anything still being added.
    // Only the cart add waits its turn, so items still go in in scan order.
    const known = cachedBarcode(code);
    const lookup = known
      ? Promise.resolve(known)
      : findByBarcode(code, {
          productSearch: shopify.productSearch,
          fetchFn: globalThis.fetch,
          online: onlineRef.current,
        });
    if (known) showStatus("success", `✓ ${describe(known).text}`);
    else {
      showStatus("info", `Looking up ${code}…`);
      lookup
        .then(
          (found) =>
            found && showStatus("success", `✓ ${describe(found).text}`),
        )
        .catch(() => {});
    }

    queue.current = queue.current.then(async () => {
      const found = await lookup.catch(() => null);
      if (!found) {
        showAlert(`Not found: ${code}. Type the price and tap a department.`);
        return;
      }
      const { cents, text } = describe(found);
      let uuid;
      try {
        uuid = await shopify.cart.addLineItem(found.variantId, qty);
      } catch (err) {
        showAlert(`Not added: ${found.title}. Scan it again.`);
        shopify.toast.show(
          `Couldn't add ${found.title} (${err?.message ?? "unknown error"}).`,
        );
        return;
      }
      if (!uuid) {
        // Staff dismissed POS's out-of-stock warning.
        showAlert(`Not added: ${found.title} (out of stock).`);
        return;
      }
      remember({
        kind: "product",
        uuid,
        variantId: found.variantId,
        title: found.title,
        cents,
        qty,
        text,
      });
    });
  }
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    const signal = shopify.scanner?.scannerData?.current;
    if (!signal?.subscribe) return undefined;
    const openedAt = Date.now();
    const staleData = signal.value?.data;
    const unsubscribe = signal.subscribe((scan) => {
      const code = String(scan?.data ?? "").trim();
      if (!code) return;
      if (code === staleData && Date.now() - openedAt < STALE_SCAN_MS) return;
      onScanRef.current(code);
    });
    return () => unsubscribe && unsubscribe();
  }, []);

  // Stable per-key tap handlers: the same function every render, so POS
  // doesn't have to re-send every key when only the price changes.
  const onKeyRef = useRef(onKey);
  onKeyRef.current = onKey;
  const handlers = useMemo(() => {
    const h = {};
    for (const k of NUM_ROWS.flat()) h[k] = () => onKeyRef.current(k);
    for (const d of DEPARTMENT_ROWS.flat())
      h[d.code] = () => onKeyRef.current(`DEPT:${d.code}`);
    return h;
  }, []);

  function undoLast() {
    // Decide what to undo now, at the tap, not when the queue gets to it.
    const last = addedRef.current[0];
    if (!last) return;
    addedRef.current = addedRef.current.slice(1);
    setAdded(addedRef.current);
    const text =
      last.kind === "product"
        ? `Removed ${last.qty} × ${last.title}`
        : `Removed ${last.qty} × $${formatCents(last.cents)} ${last.title}`;
    showStatus("info", text);
    queue.current = queue.current.then(async () => {
      if (last.failed) return; // never made it into the cart
      try {
        if (last.uuid) {
          // If POS merged repeats into one line (e.g. Party x3), only take off
          // the last one: remove the line and put back the rest.
          const line = shopify.cart.current.value?.lineItems?.find(
            (l) => l.uuid === last.uuid,
          );
          const remaining = line ? line.quantity - last.qty : 0;
          await shopify.cart.removeLineItem(last.uuid);
          if (remaining > 0) {
            let uuid;
            if (last.kind === "product") {
              uuid = await shopify.cart.addLineItem(last.variantId, remaining);
            } else {
              uuid = await shopify.cart.addCustomSale({
                title: last.title,
                price: formatCents(last.cents),
                quantity: remaining,
                taxable: last.taxable,
              });
              if (uuid) {
                Promise.resolve()
                  .then(() =>
                    shopify.cart.addLineItemProperties(uuid, {
                      [DEPT_PROPERTY_KEY]: last.code,
                    }),
                  )
                  .catch(() => {});
              }
            }
            // Earlier entries pointing at the old line now point at the new one.
            addedRef.current = addedRef.current.map((a) =>
              a.uuid === last.uuid ? { ...a, uuid } : a,
            );
            setAdded(addedRef.current);
          }
        }
      } catch (err) {
        showStatus("critical", `Couldn't remove ${last.title}`);
        shopify.toast.show(
          `Couldn't remove: ${err?.message ?? "already removed from cart?"}`,
        );
      }
    });
  }

  // The key grids only change when the style, layout, connection or picture
  // check changes, not on every tap, so they're built once and reused.
  const { numberPad, departmentGrid } = useMemo(() => {
    const numLabel = (k) => (k === "X" ? "×" : k === "C" ? "C (clear)" : k);

    const numKey = (k) => {
      const width = k === "C" ? clearWidth : px(L.numKey);
      if (showPicture(`NUM:${k}`)) {
        return (
          <s-clickable key={k} onClick={handlers[k]}>
            <s-box inlineSize={width} blockSize={px(L.numKeyH)}>
              <s-image
                src={numImageUrl(k, activeStyle)}
                alt={numLabel(k)}
                objectFit="contain"
                inlineSize="fill"
              />
            </s-box>
          </s-clickable>
        );
      }
      return (
        <s-box key={k} inlineSize={width}>
          <s-button
            variant="secondary"
            tone={k === "C" ? "critical" : "auto"}
            onClick={handlers[k]}
          >
            {numLabel(k)}
          </s-button>
        </s-box>
      );
    };

    const deptKey = (d) => {
      if (showPicture(d.code)) {
        return (
          <s-clickable key={d.code} onClick={handlers[d.code]}>
            <s-box inlineSize={px(L.deptKey)} blockSize={px(L.deptKeyH)}>
              <s-image
                src={keyImageUrl(d.code, activeStyle)}
                alt={isTablet ? d.label : d.short}
                objectFit="contain"
                inlineSize="fill"
              />
            </s-box>
          </s-clickable>
        );
      }
      return (
        <s-box key={d.code} inlineSize={px(L.deptKey)}>
          <s-button variant="primary" onClick={handlers[d.code]}>
            {isTablet ? d.label : d.short}
          </s-button>
        </s-box>
      );
    };

    return {
      numberPad: (
        <s-stack direction="block" gap={L.gap}>
          {NUM_ROWS.map((row) => (
            <s-stack key={row.join("")} direction="inline" gap={L.gap}>
              {row.map(numKey)}
            </s-stack>
          ))}
        </s-stack>
      ),
      departmentGrid: (
        <s-stack direction="block" gap={L.gap}>
          {DEPARTMENT_ROWS.map((row) => (
            <s-stack key={row[0].code} direction="inline" gap={L.gap}>
              {row.map(deptKey)}
            </s-stack>
          ))}
        </s-stack>
      ),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTablet, activeStyle, failed, online, picturesAvailable, handlers]);

  // ---------------------------------------------------------------- Style screen

  if (showStyles) {
    const previewW = isTablet ? "600px" : "330px";
    const previewH = isTablet ? "60px" : "33px";
    return (
      <s-page heading="Key style">
        <s-button slot="secondary-actions" onClick={() => setShowStyles(false)}>
          Done
        </s-button>
        <s-scroll-box>
          <s-stack direction="block" gap="large" padding={L.padding}>
            <s-text color="subdued">
              Pick how the keys look on this till. Each till remembers its own
              choice.
            </s-text>
            {!picturesAvailable && (
              <s-text tone="caution">
                Picture keys aren't set up yet (baseUrl is empty in
                departments.js).
              </s-text>
            )}
            {!online && picturesAvailable && (
              <s-text tone="caution">
                Offline: previews can't load, but you can still choose.
              </s-text>
            )}
            {STYLES.map((s) => (
              <s-clickable key={s.id} onClick={() => chooseStyle(s.id)}>
                <s-stack direction="block" gap="small">
                  <s-text type="strong">
                    {s.id === style ? `✓ ${s.name}` : s.name}
                    {!isTablet && s.phoneStyle
                      ? ` (tablet only; phones show ${getStyle(s.phoneStyle).name})`
                      : ""}
                  </s-text>
                  {picturesAvailable && online && (
                    <s-box inlineSize={previewW} blockSize={previewH}>
                      <s-image
                        src={previewImageUrl(s.id)}
                        alt={s.name}
                        objectFit="contain"
                        inlineSize="fill"
                      />
                    </s-box>
                  )}
                </s-stack>
              </s-clickable>
            ))}
          </s-stack>
        </s-scroll-box>
      </s-page>
    );
  }

  // ---------------------------------------------------------------- Sale screen

  const priceShown = `$${formatCents(pad.entry === "" ? 0 : parseInt(pad.entry, 10))}`;
  const qtyShown = pad.qty > 1 ? `${pad.qty} × ` : "";
  const lastLine = added[0]
    ? added[0].kind === "product"
      ? `Added: ${added[0].qty} × ${added[0].title}`
      : `Added: ${added[0].qty} × $${formatCents(added[0].cents)} ${added[0].title}`
    : "Type a price and a department, or scan a barcode";

  const styleNote =
    picturesAvailable && !online ? "Offline: using text keys" : null;

  // The keyed-in price is always plain text so it's never wrong or missing.
  const priceDisplay = (
    <s-heading>
      {qtyShown}
      {priceShown}
    </s-heading>
  );

  return (
    <s-page heading="Dept Sale">
      <s-button
        slot="secondary-actions"
        onClick={undoLast}
        disabled={added.length === 0}
      >
        Undo last
      </s-button>

      <s-scroll-box>
        <s-stack direction="block" gap="base" padding={L.padding}>
          {alert && (
            <s-banner heading={alert} tone="critical">
              <s-button slot="primary-action" onClick={() => setAlert(null)}>
                OK
              </s-button>
            </s-banner>
          )}
          {/* Display, like the till's screen */}
          <s-stack direction="block" gap="small-400">
            <s-stack
              direction="inline"
              justifyContent="space-between"
              alignItems="center"
            >
              {priceDisplay}
              <s-stack direction="inline" gap="base" alignItems="center">
                <s-text color="subdued">Cart {cartTotal}</s-text>
                <s-button
                  variant="secondary"
                  onClick={() => setShowStyles(true)}
                >
                  ⚙
                </s-button>
              </s-stack>
            </s-stack>
            {status ? (
              <s-badge tone={status.tone}>{status.text}</s-badge>
            ) : (
              <s-text color="subdued">{lastLine}</s-text>
            )}
            {styleNote && <s-text tone="caution">{styleNote}</s-text>}
          </s-stack>

          {/* Tablet: side by side. Phone: number pad on top, departments below. */}
          {/* Full width with the grids centred, so spare space is split evenly. */}
          <s-stack
            direction={isTablet ? "inline" : "block"}
            gap={L.sectionGap}
            justifyContent="center"
          >
            {numberPad}
            {departmentGrid}
          </s-stack>
        </s-stack>
      </s-scroll-box>
    </s-page>
  );
}

function readTotal(cart) {
  const total = String(cart?.grandTotal ?? cart?.subtotal ?? "0.00");
  // POS may send "12.50" or "$12.50" depending on version; show a $ either way.
  return /^\d/.test(total) ? `$${total}` : total;
}
