// Department keys, laid out like the old Casio till: 5 rows x 5 keys,
// top row first, left to right (as seen when standing at the till).
//
// code     -> saved on the order as a hidden line-item property (_ps_dept),
//             so department sales can be pulled from orders/exports later.
// label    -> text on the key on a tablet.
// short    -> text on the key on a phone (keys are narrow, long words wrap onto 2 lines, which is fine).
// title    -> line-item title shown in the cart and on the receipt.
// taxable  -> set to false for any GST-free department.
//
// To rename, reorder or add a department, edit this file only.

export const DEPARTMENT_ROWS = [
  [
    {
      code: "SOUVENIR",
      label: "Souvenir",
      short: "Souv",
      title: "Souvenir",
      taxable: true,
    },
    {
      code: "HARDWARE",
      label: "Hardware",
      short: "Hardw",
      title: "Hardware",
      taxable: true,
    },
    { code: "TOY", label: "Toy", short: "Toy", title: "Toy", taxable: true },
    {
      code: "MISC",
      label: "Misc",
      short: "Misc",
      title: "Misc",
      taxable: true,
    },
    {
      code: "TRAVELS",
      label: "Travels",
      short: "Travel",
      title: "Travel",
      taxable: true,
    },
  ],
  [
    {
      code: "CARD_WRAP",
      label: "Card/Wrap",
      short: "Card",
      title: "Card & Wrap",
      taxable: true,
    },
    {
      code: "HOME_DECO",
      label: "Home/Deco",
      short: "Home",
      title: "Home & Decor",
      taxable: true,
    },
    {
      code: "BABY",
      label: "Baby",
      short: "Baby",
      title: "Baby",
      taxable: true,
    },
    {
      code: "DRESS_UPS",
      label: "Dress-ups",
      short: "Dress",
      title: "Dress-ups",
      taxable: true,
    },
    {
      code: "ELECTRICAL",
      label: "Electrical",
      short: "Elec",
      title: "Electrical",
      taxable: true,
    },
  ],
  [
    {
      code: "ART_CRAFT",
      label: "Art/Craft",
      short: "Art",
      title: "Art & Craft",
      taxable: true,
    },
    {
      code: "BATHROOM",
      label: "Bathroom",
      short: "Bath",
      title: "Bathroom",
      taxable: true,
    },
    {
      code: "NOVELTY",
      label: "Novelty",
      short: "Novel",
      title: "Novelty",
      taxable: true,
    },
    {
      code: "SEASONAL",
      label: "Seasonal",
      short: "Season",
      title: "Seasonal",
      taxable: true,
    },
    {
      code: "HALLOWEEN",
      label: "Halloween",
      short: "Hallow",
      title: "Halloween",
      taxable: true,
    },
  ],
  [
    {
      code: "KITCHEN",
      label: "Kitchen",
      short: "Kitch",
      title: "Kitchen",
      taxable: true,
    },
    {
      code: "STATIONERY",
      label: "Stationery",
      short: "Statio",
      title: "Stationery",
      taxable: true,
    },
    { code: "PET", label: "Pet", short: "Pet", title: "Pet", taxable: true },
    {
      code: "SUMMER",
      label: "Summer",
      short: "Summer",
      title: "Summer",
      taxable: true,
    },
    {
      code: "EASTER",
      label: "Easter",
      short: "Easter",
      title: "Easter",
      taxable: true,
    },
  ],
  [
    {
      code: "HAIR_BEAUTY",
      label: "Hair/Beauty",
      short: "Hair",
      title: "Hair & Beauty",
      taxable: true,
    },
    {
      code: "PARTY",
      label: "Party",
      short: "Party",
      title: "Party",
      taxable: true,
    },
    {
      code: "GIFT",
      label: "Gift",
      short: "Gift",
      title: "Gift",
      taxable: true,
    },
    {
      code: "WINTER",
      label: "Winter",
      short: "Winter",
      title: "Winter",
      taxable: true,
    },
    {
      code: "XMAS",
      label: "Xmas",
      short: "Xmas",
      title: "Christmas",
      taxable: true,
    },
  ],
];

// Largest price one key-in can make, in cents ($999.99). Stops a
// fat-fingered extra zero turning $45.00 into $450.00 unnoticed.
export const MAX_PRICE_CENTS = 99999;

// Largest quantity for the x (multiply) key.
export const MAX_QTY = 99;

// Key sizes per device. "px" here are screen points, not raw pixels.
// Tablet: number pad and departments side by side.
// Phone:  number pad on top, department grid underneath, 5 across.
// If the 5th department column wraps onto a new line on a phone, lower
// phone.deptKey by a couple of px.
// numKeyH / deptKeyH are the heights of the picture keys (images are 4:3).
// On a tablet the number keys are the same size as the department keys so
// the two grids line up row for row.
// gapPx must be the size of the `gap` keyword in points. It's used to make the
// Clear bar exactly as wide as the three keys above it. If the Clear bar looks
// narrower or wider than the row above, nudge gapPx by 1-2.
export const LAYOUT = {
  tablet: {
    numKey: 128,
    numKeyH: 96,
    deptKey: 128,
    deptKeyH: 96,
    gap: "small",
    gapPx: 12,
    sectionGap: "large",
    sectionGapPx: 20,
    padding: "base",
  },
  phone: {
    numKey: 88,
    numKeyH: 66,
    deptKey: 68,
    deptKeyH: 51,
    gap: "small-400",
    gapPx: 4,
    sectionGap: "large",
    sectionGapPx: 20,
    padding: "small",
  },
};

// Picture keys. Upload every file from key-images/ to
// Shopify admin -> Content -> Files, copy the URL of any one of them and
// paste everything up to and including "/files/" into baseUrl.
// Leave baseUrl empty ('') to always use the plain text keys.
// Bump `version` whenever you re-upload changed images, so tills don't
// keep showing the old cached ones.
export const KEY_IMAGES = {
  baseUrl:
    "ENTER YOUR BASE URL HERE",
  version: "2",
};

// Key styles staff can pick from the Style screen. Each till remembers its
// own choice. `prefix` must match the file names made by tools/make_keys.py.
// `phoneStyle` (optional): the style a phone shows instead of this one.
export const STYLES = [
  { id: "classic", name: "Classic Casio", prefix: "ps-" },
  { id: "soft", name: "Soft pastel", prefix: "ps-soft-" },
  { id: "dark", name: "Dark with colour bar", prefix: "ps-dark-" },
  { id: "bold", name: "Bold colour", prefix: "ps-bold-" },
  // Product pictures are too small to read on a phone key, so phones use Soft pastel.
  {
    id: "icons",
    name: "Product icons",
    prefix: "ps-icons-",
    phoneStyle: "soft",
  },
];

// Style used until someone picks one on that till.
export const DEFAULT_STYLE = "icons";

export function getStyle(id) {
  return (
    STYLES.find((s) => s.id === id) ??
    STYLES.find((s) => s.id === DEFAULT_STYLE) ??
    STYLES[0]
  );
}

function imageUrl(file) {
  if (!KEY_IMAGES.baseUrl) return "";
  const base = KEY_IMAGES.baseUrl.endsWith("/")
    ? KEY_IMAGES.baseUrl
    : `${KEY_IMAGES.baseUrl}/`;
  return `${base}${file}?v=${KEY_IMAGES.version}`;
}

// Department key picture, e.g. PARTY in 'soft' -> ps-soft-key-party.png
export function keyImageUrl(code, styleId) {
  return imageUrl(`${getStyle(styleId).prefix}key-${code.toLowerCase()}.png`);
}

// Number pad picture, e.g. '7' -> ps-soft-num-7.png, 'X' -> ...num-x.png, 'C' -> ...num-c.png
export function numImageUrl(key, styleId) {
  return imageUrl(`${getStyle(styleId).prefix}num-${key.toLowerCase()}.png`);
}

// Small strip shown on the Style screen, e.g. ps-soft-preview.png
export function previewImageUrl(styleId) {
  return imageUrl(`ps-${getStyle(styleId).id}-preview.png`);
}

// Hidden line-item property key. The leading underscore hides it from the
// cart, the customer display and receipts; it's still on the order in admin.
export const DEPT_PROPERTY_KEY = "_ps_dept";
