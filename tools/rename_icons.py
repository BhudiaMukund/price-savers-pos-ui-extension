"""Copy the Gemini icon images into icon-sources/ with readable names.

    python3 tools/rename_icons.py            # dry run: shows what would happen
    python3 tools/rename_icons.py --apply    # actually copy

Originals are never moved or changed. Output: icon-sources/icon-<code>.<ext>,
where <code> matches the department codes in extensions/dept-sale/src/departments.js.
To swap an icon later, drop the new file in and point its entry below at it.
"""
import argparse
import os
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_SRC = '/root/.claude/uploads/386d90ac-efa9-5792-b5a5-1f8e813fd0b1'
DEFAULT_OUT = os.path.join(HERE, '..', 'icon-sources')

# department code -> source file name
ICONS = {
    'SOUVENIR': '23305bb1-image.jpg',
    'HARDWARE': 'e4af4e9f-image.jpg',
    'TOY': '35cb404f-image.jpg',
    'MISC': '70dceaf1-image.jpg',
    'TRAVELS': '0559c358-image.jpg',
    'CARD_WRAP': '6b5275f5-image.jpg',
    'HOME_DECO': '546f764e-image.jpg',
    'BABY': '04b93fa7-image.jpg',
    'DRESS_UPS': 'e9f55d2d-image.jpg',
    'ELECTRICAL': 'f753a6a7-image.jpg',
    'ART_CRAFT': '5b4221fe-image.jpg',
    'BATHROOM': 'b1e9cf1a-image.jpg',
    'NOVELTY': 'bdffaa0f-image.jpg',
    'SEASONAL': '66e9c4af-image.jpg',
    'HALLOWEEN': '050825b9-image.jpg',
    'KITCHEN': 'd36cda09-image.jpg',
    'STATIONERY': 'fcce26b6-image.jpg',
    'PET': '3450f826-image.jpg',
    'SUMMER': 'f2f4e190-image.jpg',
    'EASTER': '93c32f5a-image.jpg',
    'HAIR_BEAUTY': '0425de35-image.jpg',
    'PARTY': '8eaef62b-image.jpg',
    'GIFT': '3b7171dd-image.jpg',
    'WINTER': '51820bb1-image.jpg',
    'XMAS': 'ac46dd77-image.jpg',
}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--src', default=DEFAULT_SRC, help='folder containing the downloaded images')
    ap.add_argument('--out', default=DEFAULT_OUT, help='where to put the renamed copies')
    ap.add_argument('--apply', action='store_true', help='copy the files (default is a dry run)')
    args = ap.parse_args()

    missing = []
    for code, name in ICONS.items():
        src = os.path.join(args.src, name)
        ext = os.path.splitext(name)[1].lower()
        dst = os.path.join(args.out, f'icon-{code.lower()}{ext}')
        if not os.path.exists(src):
            missing.append(f'{code}: {src}')
            continue
        print(f'{"copy" if args.apply else "would copy"}  {name}  ->  {os.path.relpath(dst)}')
        if args.apply:
            os.makedirs(args.out, exist_ok=True)
            shutil.copy2(src, dst)

    if missing:
        print('\nMissing source files:', *missing, sep='\n  ')
        sys.exit(1)
    if not args.apply:
        print('\nDry run only. Run again with --apply to copy.')


if __name__ == '__main__':
    main()
