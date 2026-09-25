import { render } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";

import { DEPARTMENT_ROWS, LAYOUT, DEPT_PROPERTY_KEY } from "./departments.js";
import { initialState, press, formatCents } from "./keypad.js";

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

function DeptSale() {
  const [pad, setPad] = useState(initialState);
  const [added, setAdded] = useState([]); // lines added in this session, newest first
  const [cartTotal, setCartTotal] = useState(
    readTotal(shopify.cart.current.value),
  );
  const [isTablet, setIsTablet] = useState(false); // start with the phone layout; it fits everywhere
  const busy = useRef(false);

  useEffect(() => {
    const unsubscribe = shopify.cart.current.subscribe((cart) => {
      setCartTotal(readTotal(cart));
    });
    shopify.device
      .isTablet()
      .then((tablet) => setIsTablet(Boolean(tablet)))
      .catch(() => {});
    return unsubscribe;
  }, []);

  const L = isTablet ? LAYOUT.tablet : LAYOUT.phone;
  const numKeyPx = parseInt(L.numKey, 10);
  const clearWidth = `${numKeyPx * 3 + 16}px`;

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

  const departmentGrid = (
    <s-stack direction="block" gap={L.gap}>
      {DEPARTMENT_ROWS.map((row) => (
        <s-stack key={row[0].code} direction="inline" gap={L.gap}>
          {row.map((d) => (
            <s-box key={d.code} inlineSize={L.deptKey}>
              <s-button
                variant="primary"
                onClick={() => onKey(`DEPT:${d.code}`)}
              >
                {isTablet ? d.label : d.short}
              </s-button>
            </s-box>
          ))}
        </s-stack>
      ))}
    </s-stack>
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

      <s-stack direction="block" gap="base" padding={L.padding}>
        {/* Display, like the till's screen */}
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

        {/* Tablet: side by side. Phone: number pad on top, departments below. */}
        <s-stack direction={isTablet ? "inline" : "block"} gap="large">
          {numberPad}
          {departmentGrid}
        </s-stack>

        {/* What's been rung up from this screen */}
        {added.length > 0 && (
          <s-section heading="Added from this screen">
            <s-stack direction="block" gap="small-200">
              {added.slice(0, 5).map((l, i) => (
                <s-text
                  key={`${l.uuid}-${i}`}
                  color={i === 0 ? "base" : "subdued"}
                >
                  {l.qty} × ${formatCents(l.cents)} {l.title}
                </s-text>
              ))}
            </s-stack>
          </s-section>
        )}
      </s-stack>
    </s-page>
  );
}

function readTotal(cart) {
  const total = String(cart?.grandTotal ?? cart?.subtotal ?? "0.00");
  // POS may send "12.50" or "$12.50" depending on version; show a $ either way.
  return /^\d/.test(total) ? `$${total}` : total;
}
