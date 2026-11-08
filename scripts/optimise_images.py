"""
Make smaller WebP copies of the site's images in assets/webp/. The originals are never changed.

Which size each image gets is worked out from how the pages use it:
  - hero backgrounds (url(...) in page styles, and the home carousel slides)   -> 1920px wide
  - concert posters (concerts.html) and gallery photos (gallery.html)          -> 800px wide
  - other photos in page content (about, join, contact, home cards)           -> 1200px wide
An image used in more than one way gets one copy per size, e.g. name-1920.webp and name-800.webp.
Images are never enlarged, logos are skipped, and metadata (EXIF, GPS) is not copied.

Requires Python 3 and Pillow:   pip install pillow
Run from the site folder:       python scripts/optimise_images.py
Options:  --force   rebuild copies even if they are newer than the original
          --dry-run list what would be made, write nothing
"""
import argparse
import os
import re
import sys

from PIL import Image, ImageOps

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(SITE, 'assets')
OUT = os.path.join(ASSETS, 'webp')

HERO_WIDTH, CONTENT_WIDTH, THUMB_WIDTH = 1920, 1200, 800
QUALITY = 80
PAGES = ['index', 'about', 'concerts', 'gallery', 'join', 'committee', 'contact', 'support']
SKIP = {'ICSOText-1.png', 'icso-logo.jpg'}  # logos: already small, and used as the favicon


def read(path):
    with open(path, encoding='utf-8') as f:
        return f.read()


def strip_comments(html):
    return re.sub(r'<!--.*?-->', '', html, flags=re.S)


def find_uses():
    """Return {filename: set of target widths} from how the pages reference each asset."""
    uses = {}

    def add(src, width):
        name = os.path.basename(src)
        if src.startswith('/assets/') and name not in SKIP:
            uses.setdefault(name, set()).add(width)

    for page in PAGES:
        html = strip_comments(read(os.path.join(SITE, page + '.html')))
        for src in re.findall(r"url\(['\"]?(/assets/[^'\")]+)", html):          # hero backgrounds
            add(src, HERO_WIDTH)
        for src in re.findall(r"\bimg\s*:\s*'(/assets/[^']+)'", html):           # carousel slides
            add(src, HERO_WIDTH)
        for src in re.findall(r'<img\b[^>]*\ssrc="(/assets/[^"]+)"', html):      # <img> tags
            add(src, THUMB_WIDTH if page in ('concerts', 'gallery') else CONTENT_WIDTH)
    return uses


def out_name(name, width):
    stem = os.path.splitext(name)[0]
    slug = re.sub(r'-{2,}', '-', re.sub(r'[^A-Za-z0-9_-]+', '-', stem)).strip('-')
    return f'{slug}-{width}.webp'


def convert(src_path, dst_path, width):
    with Image.open(src_path) as im:
        im = ImageOps.exif_transpose(im)
        if im.mode not in ('RGB', 'RGBA'):
            im = im.convert('RGBA' if 'A' in im.getbands() else 'RGB')
        if im.width > width:
            im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
        im.save(dst_path, 'WEBP', quality=QUALITY, method=6)
        return im.size


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--force', action='store_true')
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()

    uses = find_uses()
    missing = [n for n in uses if not os.path.isfile(os.path.join(ASSETS, n))]
    for n in missing:
        print(f'warning: referenced but missing: assets/{n}', file=sys.stderr)
    if not args.dry_run:
        os.makedirs(OUT, exist_ok=True)

    rows, total_before, total_after = [], 0, 0
    for name in sorted(n for n in uses if n not in missing):
        src = os.path.join(ASSETS, name)
        for width in sorted(uses[name], reverse=True):
            dst = os.path.join(OUT, out_name(name, width))
            before = os.path.getsize(src)
            if args.dry_run:
                rows.append((name, out_name(name, width), before, None, None))
                continue
            if args.force or not os.path.exists(dst) or os.path.getmtime(dst) < os.path.getmtime(src):
                size = convert(src, dst, width)
            else:
                with Image.open(dst) as im:
                    size = im.size
            after = os.path.getsize(dst)
            total_before += before
            total_after += after
            rows.append((name, out_name(name, width), before, after, size))

    mb = lambda b: f'{b / 1048576:7.2f} MB'
    for name, out, before, after, size in rows:
        if after is None:
            print(f'would make  webp/{out:58}  from {name}')
        else:
            print(f'{mb(before)} -> {mb(after)}  ({100 - after * 100 / before:5.1f}% smaller)  {size[0]:>4}x{size[1]:<4}  webp/{out}')
    if not args.dry_run and rows:
        print(f'\n{len(rows)} copies. Originals (once per copy): {mb(total_before).strip()}  WebP copies: {mb(total_after).strip()}  '
              f'saved {100 - total_after * 100 / total_before:.1f}%')


if __name__ == '__main__':
    main()
