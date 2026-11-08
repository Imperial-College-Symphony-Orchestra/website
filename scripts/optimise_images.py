"""
Make smaller WebP copies of the site's images in assets/webp/, and (optionally) point the pages at them.
The originals in assets/ are never changed.

Which size each image gets is worked out from how the pages use it:
  - hero backgrounds (url(...) in page styles, and the home carousel slides)   -> 1920px wide
  - concert posters (concerts.html) and gallery photos (gallery.html)          -> 800px wide
  - other photos in page content (about, join, contact, home cards)           -> 1200px wide
An image used in more than one way gets one copy per size, e.g. name-1920.webp and name-800.webp.
Images are never enlarged, logos are skipped, and metadata (EXIF, GPS) is not copied.
Links to full-size images (<a href>) and the favicon always keep pointing at the originals.

Requires Python 3 and Pillow:   pip install pillow
Run from the site folder:       python scripts/optimise_images.py [options]

Adding a new image: put the original in assets/, reference it in the page as usual
(e.g. <img src="/assets/my-photo.jpg" alt="...">), then run with --update-pages.
Pages that already point at assets/webp/... are understood too, so re-running is always safe.

Options:  --update-pages  rewrite image paths in the pages to the WebP copies (and fix width/height)
          --force         rebuild copies even if they are newer than the original
          --dry-run       list what would be made, write nothing
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

# Image references the script understands (group 'src' is the path)
BG_RE = re.compile(r"""url\((?P<q>['"]?)(?P<src>/assets/[^'")]+)(?P=q)\)""")
SLIDE_RE = re.compile(r"""\bimg\s*:\s*'(?P<src>/assets/[^']+)'""")
IMG_RE = re.compile(r'<img\b[^>]*>')
PRELOAD_RE = re.compile(r'<link\b(?=[^>]*\brel="preload")(?=[^>]*\bas="image")[^>]*>')
COMMENT_RE = re.compile(r'<!--.*?-->', re.S)


def read(path):
    with open(path, encoding='utf-8', newline='') as f:
        return f.read()


def write(path, text):
    with open(path, 'w', encoding='utf-8', newline='') as f:
        f.write(text)


def slug(name):
    stem = os.path.splitext(name)[0]
    return re.sub(r'-{2,}', '-', re.sub(r'[^A-Za-z0-9_-]+', '-', stem)).strip('-')


def out_name(name, width):
    return f'{slug(name)}-{width}.webp'


_by_slug = None
def original_of(src):
    """'/assets/x y.jpg' -> 'x y.jpg';  '/assets/webp/x-y-800.webp' -> 'x y.jpg'.  None if not ours."""
    global _by_slug
    if src.startswith('/assets/webp/'):
        if _by_slug is None:
            _by_slug = {}
            for f in os.listdir(ASSETS):
                if os.path.isfile(os.path.join(ASSETS, f)):
                    if slug(f) in _by_slug:
                        print(f'warning: {f} and {_by_slug[slug(f)]} would share WebP names', file=sys.stderr)
                    _by_slug[slug(f)] = f
        stem = os.path.basename(src)[:-len('.webp')].rsplit('-', 1)[0]
        name = _by_slug.get(stem)
        if name is None:
            print(f'warning: no original found for {src}', file=sys.stderr)
        return name
    if src.startswith('/assets/') and '/' not in src[len('/assets/'):]:
        name = src[len('/assets/'):]
        return None if name in SKIP else name
    return None


def img_width_for(page):
    return THUMB_WIDTH if page in ('concerts', 'gallery') else CONTENT_WIDTH


def outside_comments(html, fn):
    """Apply fn to every part of html that is not inside an HTML comment."""
    out, pos = [], 0
    for m in COMMENT_RE.finditer(html):
        out.append(fn(html[pos:m.start()]))
        out.append(m.group(0))
        pos = m.end()
    out.append(fn(html[pos:]))
    return ''.join(out)


def page_widths(html, page):
    """{original filename: width} for every image the page shows (hero use wins)."""
    widths = {}
    def collect(chunk):
        for m in IMG_RE.finditer(chunk):
            src = re.search(r'\ssrc="([^"]+)"', m.group(0))
            name = src and original_of(src.group(1))
            if name:
                widths.setdefault(name, img_width_for(page))
        for rx in (BG_RE, SLIDE_RE):
            for m in rx.finditer(chunk):
                name = original_of(m.group('src'))
                if name:
                    widths[name] = HERO_WIDTH
        return chunk
    outside_comments(html, collect)
    return widths


def find_uses():
    """{original filename: set of widths} across all pages."""
    uses = {}
    for page in PAGES:
        for name, width in page_widths(read(os.path.join(SITE, page + '.html')), page).items():
            uses.setdefault(name, set()).add(width)
    return uses


def convert(src_path, dst_path, width):
    with Image.open(src_path) as im:
        im = ImageOps.exif_transpose(im)
        if im.mode not in ('RGB', 'RGBA'):
            im = im.convert('RGBA' if 'A' in im.getbands() else 'RGB')
        if im.width > width:
            im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
        im.save(dst_path, 'WEBP', quality=QUALITY, method=6)
        return im.size


def update_pages():
    """Point every image reference at its WebP copy. Returns the number of references changed."""
    changed_total = 0
    for page in PAGES:
        path = os.path.join(SITE, page + '.html')
        html = read(path)
        widths = page_widths(html, page)
        changed = 0

        def webp_path(name, width):
            return f'/assets/webp/{out_name(name, width)}'

        def fix_src(src, width_for):
            name = original_of(src)
            if not name or name not in widths:
                return None
            new = webp_path(name, width_for(name))
            return new if os.path.exists(os.path.join(SITE, new.lstrip('/'))) else None

        def rewrite(chunk):
            nonlocal changed

            def bg(m):
                nonlocal changed
                new = fix_src(m.group('src'), lambda n: HERO_WIDTH)
                if new and new != m.group('src'):
                    changed += 1
                    return m.group(0).replace(m.group('src'), new)
                return m.group(0)

            def img(m):
                nonlocal changed
                tag = m.group(0)
                src = re.search(r'\ssrc="([^"]+)"', tag)
                new = src and fix_src(src.group(1), lambda n: img_width_for(page))
                if not new:
                    return tag
                with Image.open(os.path.join(SITE, new.lstrip('/'))) as im:
                    w, h = im.size
                out = tag.replace(f'src="{src.group(1)}"', f'src="{new}"')
                out = re.sub(r'\swidth="\d+"', f' width="{w}"', out)
                out = re.sub(r'\sheight="\d+"', f' height="{h}"', out)
                if out != tag:
                    changed += 1
                return out

            def preload(m):
                nonlocal changed
                tag = m.group(0)
                href = re.search(r'\shref="([^"]+)"', tag)
                new = href and fix_src(href.group(1), lambda n: widths[n])
                if new and new != href.group(1):
                    changed += 1
                    return tag.replace(f'href="{href.group(1)}"', f'href="{new}"')
                return tag

            chunk = BG_RE.sub(bg, chunk)
            chunk = SLIDE_RE.sub(bg, chunk)
            chunk = IMG_RE.sub(img, chunk)
            chunk = PRELOAD_RE.sub(preload, chunk)
            return chunk

        new_html = outside_comments(html, rewrite)
        if new_html != html:
            write(path, new_html)
            print(f'updated {changed:3} image references in {page}.html')
        changed_total += changed
    return changed_total


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--update-pages', action='store_true')
    ap.add_argument('--force', action='store_true')
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()

    uses = find_uses()
    missing = [n for n in uses if not os.path.isfile(os.path.join(ASSETS, n))]
    for n in missing:
        print(f'warning: referenced but missing: assets/{n}', file=sys.stderr)
    if not args.dry_run:
        os.makedirs(OUT, exist_ok=True)

    rows, total_before, total_after, wanted = [], 0, 0, set()
    for name in sorted(n for n in uses if n not in missing):
        src = os.path.join(ASSETS, name)
        for width in sorted(uses[name], reverse=True):
            dst = os.path.join(OUT, out_name(name, width))
            wanted.add(out_name(name, width))
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

    if os.path.isdir(OUT):
        for f in sorted(set(os.listdir(OUT)) - wanted):
            print(f'note: webp/{f} is no longer used by any page (safe to delete)')

    if args.update_pages and not args.dry_run:
        print(f'\n{update_pages()} image references now point at assets/webp/')


if __name__ == '__main__':
    main()
