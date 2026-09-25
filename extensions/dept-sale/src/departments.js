// Department keys, laid out like the old Casio till: 5 rows x 5 keys,
// top row first, left to right (as seen when standing at the till).
//
// code     -> saved on the order as a hidden line-item property (_ps_dept),
//             so department sales can be pulled from orders/exports later.
// label    -> text on the key on a tablet.
// short    -> text on the key on a phone (keys are narrow, keep to 4 letters or fewer).
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
      short: "Hdwr",
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
      short: "Trvl",
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
      short: "Dres",
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
      short: "Novl",
      title: "Novelty",
      taxable: true,
    },
    {
      code: "SEASONAL",
      label: "Seasonal",
      short: "Seas",
      title: "Seasonal",
      taxable: true,
    },
    {
      code: "HALLOWEEN",
      label: "Halloween",
      short: "Hlwn",
      title: "Halloween",
      taxable: true,
    },
  ],
  [
    {
      code: "KITCHEN",
      label: "Kitchen",
      short: "Kitc",
      title: "Kitchen",
      taxable: true,
    },
    {
      code: "STATIONERY",
      label: "Stationery",
      short: "Stat",
      title: "Stationery",
      taxable: true,
    },
    { code: "PET", label: "Pet", short: "Pet", title: "Pet", taxable: true },
    {
      code: "SUMMER",
      label: "Summer",
      short: "Sumr",
      title: "Summer",
      taxable: true,
    },
    {
      code: "EASTER",
      label: "Easter",
      short: "Estr",
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
      short: "Prty",
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
      short: "Wntr",
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
// deptKeyH is the height of the picture keys (images are 4:3).
export const LAYOUT = {
  tablet: {
    numKey: "88px",
    deptKey: "120px",
    deptKeyH: "90px",
    gap: "small",
    padding: "base",
  },
  phone: {
    numKey: "88px",
    deptKey: "68px",
    deptKeyH: "51px",
    gap: "small-400",
    padding: "small",
  },
};

// Picture keys (Casio colours). Upload the files from key-images/ to
// Shopify admin -> Content -> Files, copy the URL of any one of them and
// paste everything up to and including "/files/" here.
// Leave baseUrl empty ('') to always use the plain text keys.
// Bump `version` whenever you re-upload changed images, so tills don't
// keep showing the old cached ones.
export const KEY_IMAGES = {
  baseUrl:
    "https://cdn.shopify.com/s/files/1/0705/9547/7672/files/",
  version: "1",
};

export function keyImageUrl(code) {
  if (!KEY_IMAGES.baseUrl) return "";
  const base = KEY_IMAGES.baseUrl.endsWith("/")
    ? KEY_IMAGES.baseUrl
    : `${KEY_IMAGES.baseUrl}/`;
  return `${base}ps-key-${code.toLowerCase()}.png?v=${KEY_IMAGES.version}`;
}

// Hidden line-item property key. The leading underscore hides it from the
// cart, the customer display and receipts; it's still on the order in admin.
export const DEPT_PROPERTY_KEY = "_ps_dept";
