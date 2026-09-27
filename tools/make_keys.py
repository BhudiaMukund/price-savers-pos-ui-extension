"""Generate the picture keys for the Dept Sale POS extension, in every style.

Run:     python3 tools/make_keys.py
Output:  key-images/*.png  -> upload ALL of them to Shopify admin -> Content -> Files

File names (must not be renamed after upload):
  classic  ps-key-<dept>.png        ps-num-<key>.png        ps-classic-preview.png
  soft     ps-soft-key-<dept>.png   ps-soft-num-<key>.png   ps-soft-preview.png
  dark     ps-dark-key-<dept>.png   ps-dark-num-<key>.png   ps-dark-preview.png
  bold     ps-bold-key-<dept>.png   ps-bold-num-<key>.png   ps-bold-preview.png
  icons    ps-icons-key-<dept>.png  ps-icons-num-<key>.png  ps-icons-preview.png
           (needs icon-cutouts/ from tools/cut_icons.py)

The style ids and file prefixes must match STYLES in
extensions/dept-sale/src/departments.js.

To change a colour or label, edit DEPTS / the palettes below and run again.
Needs Pillow (pip install pillow). Modern styles use the Inter font in tools/fonts.
"""
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'key-images')
FONTS = os.path.join(HERE, 'fonts')
W, H = 360, 270                 # 4:3, drawn large so it stays sharp on high-res screens
# The Clear bar spans three keys plus two gaps. Its shape must match the box in
# Modal.jsx: (3 x key width + 2 x gap) / key height = (3 x 128 + 2 x 12) / 96 = 4.25
C_W = round(H * 4.25)

# code, Casio label (\n = line break), modern label, colour family
DEPTS = [
    ('SOUVENIR', 'SOUV-\nENIR', 'Souvenir', 'white'),
    ('HARDWARE', 'HARD\nWARE', 'Hardware', 'amber'),
    ('TOY', 'TOY', 'Toy', 'green'),
    ('MISC', 'MISC', 'Misc', 'white'),
    ('TRAVELS', 'TRAVELS', 'Travels', 'white'),
    ('CARD_WRAP', 'CARD/\nWRAP', 'Card & Wrap', 'white'),
    ('HOME_DECO', 'HOME/\nDECO', 'Home & Decor', 'white'),
    ('BABY', 'BABY', 'Baby', 'pink'),
    ('DRESS_UPS', 'DRESS-\nUPS', 'Dress-ups', 'white'),
    ('ELECTRICAL', 'ELEC-\nTRICAL', 'Electrical', 'white'),
    ('ART_CRAFT', 'ART/\nCRAFT', 'Art & Craft', 'yellow'),
    ('BATHROOM', 'BATH\nROOM', 'Bathroom', 'white'),
    ('NOVELTY', 'NOVELTY', 'Novelty', 'white'),
    ('SEASONAL', 'SEA-\nSONAL', 'Seasonal', 'yellow'),
    ('HALLOWEEN', 'HALLO-\nWEEN', 'Halloween', 'white'),
    ('KITCHEN', 'KITCHEN', 'Kitchen', 'white'),
    ('STATIONERY', 'STATIO-\nNERY', 'Stationery', 'salmon'),
    ('PET', 'PET', 'Pet', 'lilac'),
    ('SUMMER', 'SUMMER', 'Summer', 'grey'),
    ('EASTER', 'EASTER', 'Easter', 'sky'),
    ('HAIR_BEAUTY', 'HAIR/\nBEAUTY', 'Hair & Beauty', 'lilac'),
    ('PARTY', 'PARTY', 'Party', 'white'),
    ('GIFT', 'GIFT', 'Gift', 'yellow'),
    ('WINTER', 'WINTER', 'Winter', 'ice'),
    ('XMAS', 'XMAS', 'Xmas', 'red'),
]
# file name part, label
NUMS = [('7', '7'), ('8', '8'), ('9', '9'), ('4', '4'), ('5', '5'), ('6', '6'),
        ('1', '1'), ('2', '2'), ('3', '3'), ('0', '0'), ('00', '00'), ('x', '×')]

# ---------------------------------------------------------------- fonts / text

CLASSIC_FONTS = [
    '/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-Bold.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
    'C:/Windows/Fonts/arialbd.ttf',
    '/Library/Fonts/Arial Bold.ttf',
]


def classic_font(size):
    for p in CLASSIC_FONTS:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return inter(700, size)


def inter(weight, size):
    return ImageFont.truetype(os.path.join(FONTS, f'inter-latin-{weight}-normal.woff'), size)


def text_options(label, wrap):
    options = [label]
    if wrap and ' ' in label and '\n' not in label:
        words = label.split(' ')
        for i in range(1, len(words)):
            second = ' '.join(words[i:])
            if second.startswith('&'):
                continue  # 'Card &' / 'Wrap' reads better than 'Card' / '& Wrap'
            options.append(' '.join(words[:i]) + '\n' + second)
    return options


def fit(d, label, font_fn, max_w, max_h, max_size, wrap=True):
    """Largest font (and line break) where the label fits the box."""
    for size in range(max_size, 16, -2):
        f = font_fn(size)
        for text in text_options(label, wrap):
            l, t, r, b = d.multiline_textbbox((0, 0), text, font=f, spacing=size // 6, align='center')
            if r - l <= max_w and b - t <= max_h:
                return f, text
    return font_fn(16), label


def draw_text(img, label, font_fn, max_size, colour, box, wrap=True):
    d = ImageDraw.Draw(img)
    x0, y0, x1, y1 = box
    f, text = fit(d, label, font_fn, x1 - x0, y1 - y0, max_size, wrap)
    sp = f.size // 6
    l, t, r, b = d.multiline_textbbox((0, 0), text, font=f, spacing=sp, align='center')
    d.multiline_text((x0 + (x1 - x0 - (r - l)) / 2 - l, y0 + (y1 - y0 - (b - t)) / 2 - t), text,
                     font=f, fill=colour, spacing=sp, align='center')


def uniform_size(labels, font_fn, max_w, max_h, max_size):
    """One font size for every department key, so the grid looks even."""
    d = ImageDraw.Draw(Image.new('RGB', (10, 10)))
    return min(fit(d, l, font_fn, max_w, max_h, max_size)[0].size for l in labels)


def shadow(w, h, r, alpha=110):
    sh = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle((10, 18, w - 11, h - 7), r, fill=(0, 0, 0, alpha))
    return sh.filter(ImageFilter.GaussianBlur(10))


# ---------------------------------------------------------------- styles
# Each style: dept(label, family, size, w, h) and num(label, size, w, h, clear)

class Classic:
    id, prefix = 'classic', 'ps-'
    R = 36
    COL = {'white': (236, 238, 240), 'grey': (214, 218, 224), 'ice': (200, 216, 232),
           'sky': (186, 212, 236), 'yellow': (242, 210, 46), 'amber': (242, 184, 48),
           'green': (124, 200, 122), 'pink': (242, 191, 196), 'salmon': (239, 184, 176),
           'lilac': (205, 181, 228), 'red': (231, 120, 120)}
    TEXT = (30, 34, 39)

    def label(self, casio, modern):
        return casio

    def dept_size(self):
        return 78  # classic sizes each key to fit (as originally designed)

    def _key(self, w, h, fill, edge):
        img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        d.rounded_rectangle((0, 0, w - 1, h - 1), self.R, fill=edge)
        d.rounded_rectangle((6, 6, w - 7, h - 7), self.R - 6, fill=fill)
        return img

    def dept(self, label, fam, size, w=W, h=H):
        col = self.COL[fam]
        img = self._key(w, h, col, tuple(max(0, c - 40) for c in col))
        draw_text(img, label, classic_font, size, self.TEXT, (30, 30, w - 30, h - 30), wrap=False)
        return img

    def num(self, label, w=W, h=H, clear=False):
        if clear:
            img = self._key(w, h, (205, 70, 66), (235, 110, 105))
            draw_text(img, 'C  CLEAR', classic_font, 110, (242, 244, 246), (30, 30, w - 30, h - 30), False)
        else:
            img = self._key(w, h, (59, 64, 72), (96, 104, 115))
            draw_text(img, label, classic_font, 150, (242, 244, 246), (30, 30, w - 30, h - 30), False)
        return img


class Soft:
    id, prefix = 'soft', 'ps-soft-'
    R = 44
    COL = {'white': (241, 243, 246), 'grey': (222, 226, 232), 'amber': (253, 196, 88),
           'yellow': (252, 222, 90), 'green': (134, 214, 150), 'pink': (250, 196, 206),
           'salmon': (249, 184, 170), 'lilac': (209, 190, 243), 'sky': (178, 214, 247),
           'ice': (206, 222, 240), 'red': (244, 126, 126)}

    def label(self, casio, modern):
        return modern

    def font(self, size):
        return inter(600, size)

    def dept_size(self):
        return uniform_size([m for _, _, m, _ in DEPTS], self.font, W - 68, H - 70, 64)

    def _key(self, w, h, fill):
        img = shadow(w, h, self.R)
        ImageDraw.Draw(img).rounded_rectangle((8, 6, w - 9, h - 14), self.R, fill=fill)
        return img

    def dept(self, label, fam, size, w=W, h=H):
        img = self._key(w, h, self.COL[fam])
        draw_text(img, label, self.font, size, (28, 32, 38), (34, 26, w - 34, h - 34))
        return img

    def num(self, label, w=W, h=H, clear=False):
        img = self._key(w, h, (236, 90, 84) if clear else (48, 53, 61))
        fn = (lambda s: inter(600, s)) if clear else (lambda s: inter(500, s))
        draw_text(img, 'Clear' if clear else label, fn, 96 if clear else 130, (255, 255, 255),
                  (34, 26, w - 34, h - 34))
        return img


class Dark:
    id, prefix = 'dark', 'ps-dark-'
    R = 44
    ACC = {'white': (148, 160, 176), 'grey': (148, 160, 176), 'amber': (251, 176, 59),
           'yellow': (250, 210, 60), 'green': (74, 201, 110), 'pink': (244, 143, 177),
           'salmon': (248, 150, 130), 'lilac': (177, 145, 240), 'sky': (96, 175, 245),
           'ice': (140, 190, 235), 'red': (240, 90, 90)}

    def label(self, casio, modern):
        return modern

    def font(self, size):
        return inter(600, size)

    def dept_size(self):
        return uniform_size([m for _, _, m, _ in DEPTS], self.font, W - 60, H - 74, 64)

    def dept(self, label, fam, size, w=W, h=H):
        img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        d.rounded_rectangle((4, 4, w - 5, h - 5), self.R, fill=(40, 44, 51), outline=(58, 63, 72), width=3)
        d.rounded_rectangle((40, 24, w - 41, 36), 6, fill=self.ACC[fam])
        draw_text(img, label, self.font, size, (240, 242, 245), (30, 50, w - 30, h - 24))
        return img

    def num(self, label, w=W, h=H, clear=False):
        img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        if clear:
            d.rounded_rectangle((4, 4, w - 5, h - 5), self.R, fill=(70, 34, 36), outline=(236, 90, 84), width=4)
            draw_text(img, 'Clear', lambda s: inter(600, s), 96, (255, 130, 124), (30, 24, w - 30, h - 24))
        else:
            d.rounded_rectangle((4, 4, w - 5, h - 5), self.R, fill=(30, 33, 38), outline=(52, 57, 65), width=3)
            draw_text(img, label, lambda s: inter(500, s), 130, (255, 255, 255), (30, 24, w - 30, h - 24))
        return img


class Bold:
    id, prefix = 'bold', 'ps-bold-'
    R = 44
    COL = {'white': (71, 85, 105), 'grey': (100, 116, 139), 'amber': (234, 138, 20),
           'yellow': (202, 160, 8), 'green': (34, 160, 90), 'pink': (219, 80, 130),
           'salmon': (224, 100, 80), 'lilac': (132, 90, 220), 'sky': (37, 125, 220),
           'ice': (70, 140, 200), 'red': (210, 50, 50)}

    def label(self, casio, modern):
        return modern

    def font(self, size):
        return inter(700, size)

    def dept_size(self):
        return uniform_size([m for _, _, m, _ in DEPTS], self.font, W - 60, H - 70, 64)

    def _key(self, w, h, fill):
        img = shadow(w, h, self.R, alpha=140)
        ImageDraw.Draw(img).rounded_rectangle((8, 6, w - 9, h - 14), self.R, fill=fill)
        return img

    def dept(self, label, fam, size, w=W, h=H):
        img = self._key(w, h, self.COL[fam])
        draw_text(img, label, self.font, size, (255, 255, 255), (30, 26, w - 30, h - 34))
        return img

    def num(self, label, w=W, h=H, clear=False):
        img = self._key(w, h, (210, 50, 50) if clear else (39, 43, 50))
        draw_text(img, 'Clear' if clear else label, lambda s: inter(600, s), 96 if clear else 130,
                  (255, 255, 255), (30, 26, w - 30, h - 34))
        return img


class Icons(Soft):
    """Soft tinted key, product icons in the top-right corner, name along the bottom.

    Uses the transparent icons in icon-cutouts/ (made by tools/cut_icons.py).
    Number pad is the same as Soft. Saved as full-colour PNGs (photo=True),
    because the icons are photographic and posterise if colour-reduced.
    """
    id, prefix = 'icons', 'ps-icons-'
    photo = True
    ICON_DIR = os.path.join(HERE, '..', 'icon-cutouts')

    def dept_size(self):
        # one line, same size on every key
        d = ImageDraw.Draw(Image.new('RGB', (10, 10)))
        return min(fit(d, m, self.font, W - 64, 60, 44, wrap=False)[0].size for _, _, m, _ in DEPTS)

    def dept(self, label, fam, size, w=W, h=H, code=None):
        base = self.COL[fam]
        tint = tuple(int(c + (255 - c) * 0.35) for c in base)
        img = self._key(w, h, tint)
        # icon cluster, top-right
        path = os.path.join(self.ICON_DIR, f'icon-{(code or "").lower()}.png')
        if code and os.path.exists(path):
            icon = Image.open(path).convert('RGBA')
            box_w, box_h = int(w * 0.60), int(h * 0.64)
            icon.thumbnail((box_w, box_h), Image.LANCZOS)
            x = w - 22 - icon.width
            y = 16 + (box_h - icon.height) // 2
            img.alpha_composite(icon, (x, y))
        else:
            print(f'  (no icon for {code}; key will show the name only)')
        # name, bottom-left, one line
        d = ImageDraw.Draw(img)
        f = self.font(size)
        # same baseline on every key, so 'Toy' and 'Party' line up with 'Misc'
        d.text((30, h - 42), label, font=f, fill=(28, 32, 38), anchor='ls')
        return img


STYLES = [Classic(), Soft(), Dark(), Bold(), Icons()]

# ---------------------------------------------------------------- output


def save(img, name, photo=False):
    if photo:
        img.save(os.path.join(OUT, name), optimize=True)
    else:
        img.quantize(colors=96, method=Image.Quantize.FASTOCTREE).save(os.path.join(OUT, name), optimize=True)


def preview(style, keys):
    """Small strip shown in the style picker: 3 number keys + 4 departments."""
    kw, kh, g = 120, 90, 8
    strip = Image.new('RGBA', (7 * kw + 6 * g + 16, kh), (0, 0, 0, 0))
    items = [keys['num-7'], keys['num-8'], keys['num-9'],
             keys['key-party'], keys['key-hardware'], keys['key-toy'], keys['key-xmas']]
    x = 0
    for i, im in enumerate(items):
        if i == 3:
            x += 16
        strip.paste(im.resize((kw, kh), Image.LANCZOS), (x, 0), im.resize((kw, kh), Image.LANCZOS))
        x += kw + g
    return strip


def build(style):
    size = style.dept_size()
    keys = {}
    for code, casio, modern, fam in DEPTS:
        if getattr(style, 'photo', False):
            img = style.dept(style.label(casio, modern), fam, size, code=code)
        else:
            img = style.dept(style.label(casio, modern), fam, size)
        keys[f'key-{code.lower()}'] = img
        save(img, f'{style.prefix}key-{code.lower()}.png', getattr(style, 'photo', False))
    for name, label in NUMS:
        img = style.num(label)
        keys[f'num-{name}'] = img
        save(img, f'{style.prefix}num-{name}.png')
    save(style.num('', w=C_W, clear=True), f'{style.prefix}num-c.png')
    save(preview(style, keys), f'ps-{style.id}-preview.png', getattr(style, 'photo', False))
    return len(DEPTS) + len(NUMS) + 2


if __name__ == '__main__':
    # Build every style, or only the ones named: python3 tools/make_keys.py icons
    import sys
    wanted = set(sys.argv[1:])
    chosen = [s for s in STYLES if not wanted or s.id in wanted]
    os.makedirs(OUT, exist_ok=True)
    total = sum(build(s) for s in chosen)
    print(f'Wrote {total} images for {len(chosen)} style(s) to {os.path.abspath(OUT)}')
