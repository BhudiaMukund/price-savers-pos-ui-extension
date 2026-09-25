import { render } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";

import {
  DEPARTMENT_ROWS,
  LAYOUT,
  DEPT_PROPERTY_KEY,
  KEY_IMAGES,
  keyImageUrl,
} from "./departments.js";
import { initialState, press, formatCents } from "./keypad.js";
import { probeAll } from "./imageProbe.js";

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

const ALL_CODES = DEPARTMENT_ROWS.flat().map((d) => d.code);

// Result of the last picture check, kept while POS keeps the extension loaded
// so reopening Dept Sale doesn't flash text keys before switching to pictures.
let lastFailed = null;

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
  // Department codes whose picture couldn't be loaded; those keys show as text.
  const [failed, setFailed] = useState(lastFailed ?? new Set());
  const busy = useRef(false);

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
    return () => unsubs.forEach((u) => u && u());
  }, []);

  // Check the pictures on open and every time the internet comes back.
  useEffect(() => {
    if (!KEY_IMAGES.baseUrl || !online) return;
    let cancelled = false;
    probeAll(ALL_CODES, keyImageUrl)
      .then((bad) => {
        if (cancelled) return;
        lastFailed = bad;
        setFailed(bad);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [online]);

  const L = isTablet ? LAYOUT.tablet : LAYOUT.phone;
  const clearWidth = `${parseInt(L.numKey, 10) * 3 + 16}px`;
  const picturesAvailable = Boolean(KEY_IMAGES.baseUrl);
  // A key shows its picture only if pictures are set up, we're online, and
  // that key's image loaded in the last check. Otherwise it's a text button.
  const showPicture = (code) =>
    picturesAvailable && online && !failed.has(code);

  async function onKey(key) {
    if (busy.current) return; // ignore taps while a line is being added

    const result = press(pad, key);
    if (result.error) {
      shopify.toast.show(result.error);
      setPad(result.state);
      return;
    }
    if (!result.sale) {
      setPad(result.state);
      return;
    }

    const { code, cents, qty } = result.sale;
    const dept = DEPTS_BY_CODE[code];
    busy.current = true;
    try {
      const uuid = await shopify.cart.addCustomSale({
        title: dept.title,
        price: formatCents(cents),
        quantity: qty,
        taxable: dept.taxable,
      });
      if (uuid) {
        // Tag the line with its department for reporting. Not critical,
        // so a failure here shouldn't block the sale.
        shopify.cart
          .addLineItemProperties(uuid, { [DEPT_PROPERTY_KEY]: code })
          .catch(() => {});
      }
      setAdded((prev) =>
        [{ uuid, title: dept.title, cents, qty }, ...prev].slice(0, 20),
      );
      setPad(result.state);
    } catch (err) {
      // Keep what was typed so staff can just press the key again.
      shopify.toast.show(
        `Couldn't add item: ${err?.message ?? "unknown error"}`,
      );
    } finally {
      busy.current = false;
    }
  }

  async function undoLast() {
    const [last, ...rest] = added;
    if (!last || busy.current) return;
    busy.current = true;
    try {
      if (last.uuid) await shopify.cart.removeLineItem(last.uuid);
      shopify.toast.show(
        `Removed ${last.qty} × $${formatCents(last.cents)} ${last.title}`,
      );
    } catch (err) {
      shopify.toast.show(
        `Couldn't remove: ${err?.message ?? "already removed from cart?"}`,
      );
    } finally {
      setAdded(rest);
      busy.current = false;
    }
  }

  const priceShown = `$${formatCents(pad.entry === "" ? 0 : parseInt(pad.entry, 10))}`;
  const qtyShown = pad.qty > 1 ? `${pad.qty} × ` : "";
  const lastLine = added[0]
    ? `Added: ${added[0].qty} × $${formatCents(added[0].cents)} ${added[0].title}`
    : "Type a price, then a department";

  const numberPad = (
    <s-stack direction="block" gap={L.gap}>
      {NUM_ROWS.map((row) => (
        <s-stack key={row.join("")} direction="inline" gap={L.gap}>
          {row.map((k) => (
            <s-box key={k} inlineSize={k === "C" ? clearWidth : L.numKey}>
              <s-button
                variant="secondary"
                tone={k === "C" ? "critical" : "auto"}
                onClick={() => onKey(k)}
              >
                {k === "X" ? "×" : k === "C" ? "C (clear)" : k}
              </s-button>
            </s-box>
          ))}
        </s-stack>
      ))}
    </s-stack>
  );

  const pictureKey = (d) => (
    <s-clickable key={d.code} onClick={() => onKey(`DEPT:${d.code}`)}>
      <s-box inlineSize={L.deptKey} blockSize={L.deptKeyH}>
        <s-image
          src={keyImageUrl(d.code)}
          alt={isTablet ? d.label : d.short}
          objectFit="contain"
          inlineSize="fill"
        />
      </s-box>
    </s-clickable>
  );

  const textKey = (d) => (
    <s-box key={d.code} inlineSize={L.deptKey}>
      <s-button variant="primary" onClick={() => onKey(`DEPT:${d.code}`)}>
        {isTablet ? d.label : d.short}
      </s-button>
    </s-box>
  );

  const departmentGrid = (
    <s-stack direction="block" gap={L.gap}>
      {DEPARTMENT_ROWS.map((row) => (
        <s-stack key={row[0].code} direction="inline" gap={L.gap}>
          {row.map((d) => (showPicture(d.code) ? pictureKey(d) : textKey(d)))}
        </s-stack>
      ))}
    </s-stack>
  );

  let styleNote = null;
  if (picturesAvailable && !online) styleNote = "Offline: using text keys";

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
          {/* Display, like the till's screen */}
          <s-stack direction="block" gap="small-400">
            <s-stack
              direction="inline"
              justifyContent="space-between"
              alignItems="center"
            >
              <s-heading>
                {qtyShown}
                {priceShown}
              </s-heading>
              <s-text color="subdued">Cart {cartTotal}</s-text>
            </s-stack>
            <s-text color="subdued">{lastLine}</s-text>
            {styleNote && <s-text tone="caution">{styleNote}</s-text>}
          </s-stack>

          {/* Tablet: side by side. Phone: number pad on top, departments below. */}
          <s-stack direction={isTablet ? "inline" : "block"} gap="large">
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
