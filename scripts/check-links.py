# Checks every internal docs link and #anchor in content/docs, and every
# /images/... path, straight from the MDX (no server needed). Run from the
# repo root: python3 scripts/check-links.py   ("bad 0" means all good).
# Anchors follow Fumadocs' heading slugs; pages can declare extra anchors
# with <span id="..." />.
import re, os, glob
root = 'content/docs'

def slug(h):
    h = re.sub(r'<[^>]+>', '', h).strip().lower()
    h = re.sub(r'[`*_]', '', h)
    h = re.sub(r'[^\w\- ]', '', h)
    return h.replace(' ', '-')

pages = {}
for f in glob.glob(root + '/**/*.mdx', recursive=True):
    parts = [x for x in os.path.relpath(f, root)[:-4].split('/') if not (x.startswith('(') and x.endswith(')'))]
    url = '/' + '/'.join(parts)
    if url.endswith('/index'):
        url = url[:-6] or '/'
    if url == '/index':
        url = '/'
    txt = open(f).read()
    anchors = {slug(m) for m in re.findall(r'^#{1,6} (.+)$', txt, re.M)}
    anchors |= set(re.findall(r'<span id="([^"]+)"', txt))
    pages[url] = (f, anchors)

bad = 0
for url, (f, _) in pages.items():
    txt = open(f).read()
    for m in re.finditer(r'\]\((/[^)\s]*|#[^)\s]+)\)|href=\{?"(/[^"]*)"', txt):
        link = m.group(1) or m.group(2)
        if link.startswith('/images') or link.startswith('/demos'):
            if not os.path.exists('public' + link):
                print('FILE', f, link); bad += 1
            continue
        p, _, a = link.partition('#')
        p = p or url
        if p not in pages:
            print('PAGE', f, link); bad += 1; continue
        if a and a not in pages[p][1]:
            print('ANCHOR', f, link); bad += 1
print('bad', bad, 'pages', len(pages))
