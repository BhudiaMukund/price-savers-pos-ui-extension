"""Remove the white background from the icon images, ready for the Icons key style.

    pip install "rembg[cpu]"
    python3 tools/cut_icons.py                 # all icons in icon-sources/
    python3 tools/cut_icons.py hardware xmas   # only these

Input:  icon-sources/icon-<code>.jpg|png   (from Gemini, white background)
Output: icon-cutouts/icon-<code>.png       (transparent background, trimmed)

Uses an AI cut-out model rather than "delete white", so white objects
(power board, bath cup, baby bottle) are kept. The model (~180 MB) downloads
automatically the first time.
"""
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', 'icon-sources')
OUT = os.path.join(HERE, '..', 'icon-cutouts')
MAX_SIDE = 1024  # plenty for a key; keeps cut-outs quick and files small

# Icons where the AI cut-out removes too much (fluffy boa, cream notebook
# cover, photo frame centre). For these, also keep anything that isn't
# white background connected to the image edge.
KEEP_ENCLOSED = {'dress_ups', 'stationery', 'home_deco'}


def edge_background_mask(im):
    """True where a pixel is near-white AND connected to the image border."""
    import numpy as np
    from scipy import ndimage
    a = np.asarray(im.convert('RGB')).astype(int)
    near_white = (a.min(axis=2) > 228) & ((a.max(axis=2) - a.min(axis=2)) < 22)
    labels, _ = ndimage.label(near_white)
    border = set(np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]])))
    border.discard(0)
    return np.isin(labels, list(border))


def main():
    try:
        from rembg import new_session, remove
    except ImportError:
        sys.exit('Needs rembg: pip install "rembg[cpu]"')

    wanted = {w.lower() for w in sys.argv[1:]}
    os.makedirs(OUT, exist_ok=True)
    session = new_session('isnet-general-use')
    files = sorted(f for f in os.listdir(SRC) if f.startswith('icon-') and f.lower().endswith(('.jpg', '.jpeg', '.png')))
    done = 0
    for f in files:
        code = os.path.splitext(f)[0][len('icon-'):]
        if wanted and code not in wanted:
            continue
        im = Image.open(os.path.join(SRC, f)).convert('RGB')
        im.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
        cut = remove(im, session=session)
        if code in KEEP_ENCLOSED:
            import numpy as np
            keep = ~edge_background_mask(im)
            # soften the extra mask's edge a little so it blends with the AI edge
            from PIL import ImageFilter
            extra = Image.fromarray((keep * 255).astype('uint8')).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.2))
            alpha = Image.fromarray(np.maximum(np.asarray(cut.getchannel('A')), np.asarray(extra)))
            cut = im.convert('RGBA')
            cut.putalpha(alpha)
        # Trim to the visible objects (ignore near-invisible specks).
        alpha = cut.getchannel('A').point(lambda a: 255 if a > 24 else 0)
        box = alpha.getbbox()
        if box:
            cut = cut.crop(box)
        cut.save(os.path.join(OUT, f'icon-{code}.png'), optimize=True)
        done += 1
        print(f'cut  {f}  ->  icon-cutouts/icon-{code}.png  {cut.size[0]}x{cut.size[1]}')
    print(f'Done: {done} icon(s).')


if __name__ == '__main__':
    main()
