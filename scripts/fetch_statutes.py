#!/usr/bin/env python3
"""Download the Arizona Revised Statutes sections the app cites into static JSON.

Usage: python3 scripts/fetch_statutes.py [--refresh] [--offline]

Why: azleg.gov blocks iframes (X-Frame-Options: SAMEORIGIN) and sends no CORS headers,
so the browser can't show statute text directly. This script fetches it at build time.

Which sections:
  1. Every azleg ARS link annotation in public/epm.pdf (/ars/<title>/<NNNNN>[-NN].htm,
     including /viewdocument/?docName=... wrappers).
  2. A.R.S. references in source/epm.txt ("A.R.S. § 16-579(A)(1)", "§§ 16-121.01 and 16-122").
  3. A.R.S. entries in src/data/calendar.json `statutes`.
  4. `statute:` cites in src/features/ballot-guide/tree.ts.
  Plus one level of cross-references: Title 16 and Title 19 sections cited inside the text
  of the sections above ("section 16-584", "sections 16-542 and 16-543"). No further recursion.

Output (the UI depends on this shape):
  public/statutes/index.json   {retrieved, source, sections: {id: title}, missing: {id: reason}}
  public/statutes/<id>.json    {id, title, url, retrieved, notes, paragraphs}

Fetching is polite: one request at a time, ~0.5s apart, a descriptive User-Agent, and
retries with backoff on 5xx and timeouts. Raw HTML is cached under .cache/azleg/ (gitignored),
so reruns don't hit the server; --refresh ignores the cache, --offline never hits the network.
`retrieved` is the date the cached page was downloaded (its file mtime).

Standard library only, except pypdf for reading PDF link annotations when it is installed
(otherwise the PDF's streams are scanned directly).
"""

import argparse
import html
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
import zlib
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PDF = os.path.join(ROOT, 'public', 'epm.pdf')
EPM_TXT = os.path.join(ROOT, 'source', 'epm.txt')
CALENDAR = os.path.join(ROOT, 'src', 'data', 'calendar.json')
TREE = os.path.join(ROOT, 'src', 'features', 'ballot-guide', 'tree.ts')
OUT_DIR = os.path.join(ROOT, 'public', 'statutes')
CACHE_DIR = os.path.join(ROOT, '.cache', 'azleg')

BASE = 'https://www.azleg.gov'
SOURCE = 'https://www.azleg.gov/arstitle/'
USER_AGENT = 'az-elex-manual statute fetcher (+https://github.com/wtadler/az-elex-manual)'
DELAY = 0.5
RETRIES = 4
TIMEOUT = 30
CROSS_REF_TITLES = {'16', '19'}

# ---------------------------------------------------------------- ids and URLs

ID_RE = re.compile(r'^(\d{1,2})-(\d{3,4})(?:\.(\d{1,3}))?$')
URL_RE = re.compile(r'azleg\.gov/ars/(\d{1,2})/(\d{5})(?:-(\d{1,3}))?\.htm', re.IGNORECASE)


def url_to_id(url):
    """'https://www.azleg.gov/ars/16/00121-01.htm' -> '16-121.01'; None if not an ARS page."""
    m = URL_RE.search(url)
    if not m:
        return None
    title, sec, sub = m.groups()
    sid = f'{int(title)}-{int(sec)}'
    return f'{sid}.{sub}' if sub else sid


def id_to_url(sid):
    """'16-121.01' -> 'https://www.azleg.gov/ars/16/00121-01.htm'."""
    m = ID_RE.match(sid)
    if not m:
        raise ValueError(f'not a section id: {sid!r}')
    title, sec, sub = m.groups()
    path = f'{int(sec):05d}' + (f'-{sub}' if sub else '')
    return f'{BASE}/ars/{int(title)}/{path}.htm'


def sort_key(sid):
    """Numeric order: 16-121 < 16-121.01 < 16-122 < 19-101."""
    title, sec, sub = ID_RE.match(sid).groups()
    return (int(title), int(sec), int(sub) if sub else -1)


def normalize(ref):
    """'16-542(C)' -> '16-542'; '16- 510' -> '16-510'; None if it isn't an A.R.S. section."""
    m = re.match(r'^\s*(\d{1,2})-\s?(\d{3,4}(?:\.\d{1,3})?)(?![\d-])', ref)
    if not m:
        return None
    sid = f'{int(m.group(1))}-{m.group(2)}'
    return sid if ID_RE.match(sid) else None


# ---------------------------------------------------------------- references in text

_SUB = r'\s?\([A-Za-z0-9]{1,4}\)'
_SUBS = rf'(?:(?:{_SUB})+(?:\s?-\s?(?:{_SUB})+)?)'
_ONE = r'\d{1,2}-\s?\d{3,4}(?:\.\d{1,3})?(?![\d-]|\.\d)'
_REF = rf'(?<![\d.-]){_ONE}{_SUBS}?(?:,\s?(?:and\s|or\s)?{_SUBS})*'
_SEP = r'\s?(?:,\s?(?:and|or)\s|,|;|and|or|through|to)\s?(?:A\.R\.S\.\s?)?(?:§§?\s?)?'
_LIST = rf'{_REF}(?:{_SEP}{_REF})*'
ARS_REF_RE = re.compile(rf'(?:A\.R\.S\.\s?§§?|§§?|A\.R\.S\.)\s?(?:{_LIST})')
SECTION_REF_RE = re.compile(rf'\bsections?\s(?:{_LIST})', re.IGNORECASE)
_ID_IN_LIST = re.compile(rf'(?<![\d.-])({_ONE})')


def _ids_in(regex, text, titles=None):
    text = re.sub(r'\s+', ' ', text)
    found = []
    for m in regex.finditer(text):
        for one in _ID_IN_LIST.findall(m.group(0)):
            sid = normalize(one)
            if sid and (titles is None or sid.split('-')[0] in titles) and sid not in found:
                found.append(sid)
    return found


# In pdftotext output a footnote number can run into a citation that ends a paragraph:
# "A.R.S. § 16-211.12 A minor..." is § 16-211, a period, and footnote 12. ARS decimal
# suffixes start with 0 (16-121.01), so "16-407.031 For..." is § 16-407.03 plus footnote 1.
_GLUED_FOOTNOTE = re.compile(r'(\d{1,2}-\d{3,4})\.(\d+)(?=\s+[A-Z\u2022\uf0b7]|\s*$)')


def _unglue_footnote(m):
    base, digits = m.groups()
    return f'{base}.{digits[:2]} ' if digits.startswith('0') else f'{base}. '


def extract_ars_refs(text):
    """Section ids cited as 'A.R.S. § 16-579(A)', '§§ 16-121.01 and 16-122', etc.

    Ranges ('16-971 through 16-979') contribute both ends only.
    """
    return _ids_in(ARS_REF_RE, _GLUED_FOOTNOTE.sub(_unglue_footnote, text))


def extract_section_refs(text, titles=CROSS_REF_TITLES):
    """Section ids cited inside statute text as 'section 16-584' or 'sections 16-542 and 16-543'."""
    return _ids_in(SECTION_REF_RE, text, titles)


# ---------------------------------------------------------------- sources


def pdf_uris(path):
    try:
        import pypdf
    except ImportError:
        return _pdf_uris_raw(path)
    uris = []
    for page in pypdf.PdfReader(path).pages:
        for annot in page.get('/Annots') or []:
            action = annot.get_object().get('/A')
            if action and '/URI' in action:
                uris.append(str(action['/URI']))
    return uris


def _pdf_uris_raw(path):
    """Fallback without pypdf: scan raw and Flate-decoded streams for /URI strings."""
    data = open(path, 'rb').read()
    chunks = [data]
    for m in re.finditer(rb'stream\r?\n', data):
        try:
            chunks.append(zlib.decompressobj().decompress(data[m.end():m.end() + 2_000_000]))
        except zlib.error:
            pass
    uris = []
    for chunk in chunks:
        uris += [u.decode('latin-1') for u in re.findall(rb'/URI\s*\(([^)]*)\)', chunk)]
    return uris


def seed_ids():
    """Section ids from the four sources, in first-seen order, with where each came from."""
    sources = {}

    def add(sid, src):
        if sid:
            sources.setdefault(sid, set()).add(src)

    for uri in pdf_uris(PDF):
        add(url_to_id(uri), 'pdf-link')
    with open(EPM_TXT, encoding='utf-8') as f:
        for sid in extract_ars_refs(f.read()):
            add(sid, 'epm-text')
    with open(CALENDAR, encoding='utf-8') as f:
        for entry in json.load(f):
            for ref in entry['statutes']:
                add(normalize(ref), 'calendar')
    with open(TREE, encoding='utf-8') as f:
        for ref in re.findall(r"statute:\s*['\"]([^'\"]+)['\"]", f.read()):
            add(normalize(ref), 'ballot-guide')
    return sources


# ---------------------------------------------------------------- fetching


class Fetcher:
    def __init__(self, refresh=False, offline=False):
        self.refresh = refresh
        self.offline = offline
        self.last = 0.0
        self.requests = 0

    def cache_path(self, sid):
        url = id_to_url(sid)
        return os.path.join(CACHE_DIR, *url.split('/ars/')[1].split('/'))

    def get(self, sid):
        """Return (status, html_text_or_None, retrieved_date). status is 'ok' or a reason."""
        path = self.cache_path(sid)
        missing_marker = path + '.missing'
        if not self.refresh:
            if os.path.exists(path):
                return 'ok', _read(path), _mtime_date(path)
            if os.path.exists(missing_marker):
                return _read(missing_marker).strip(), None, _mtime_date(missing_marker)
        if self.offline:
            return 'not cached (offline)', None, date.today()
        status, body = self._download(id_to_url(sid))
        os.makedirs(os.path.dirname(path), exist_ok=True)
        if status == 'ok':
            with open(path, 'w', encoding='utf-8') as f:
                f.write(body)
            if os.path.exists(missing_marker):
                os.remove(missing_marker)
        elif status == '404':
            with open(missing_marker, 'w', encoding='utf-8') as f:
                f.write(status + '\n')
        return status, body if status == 'ok' else None, date.today()

    def _download(self, url):
        for attempt in range(RETRIES + 1):
            wait = DELAY - (time.monotonic() - self.last)
            if wait > 0:
                time.sleep(wait)
            self.last = time.monotonic()
            self.requests += 1
            req = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})
            try:
                with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
                    return 'ok', resp.read().decode('utf-8', errors='replace')
            except urllib.error.HTTPError as e:
                if e.code < 500:
                    return str(e.code), None
                reason = str(e.code)
            except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
                reason = f'network error: {getattr(e, "reason", e)}'
            if attempt < RETRIES:
                backoff = 2 ** attempt
                print(f'  {url}: {reason}; retrying in {backoff}s', file=sys.stderr)
                time.sleep(backoff)
        return reason, None


def _read(path):
    with open(path, encoding='utf-8') as f:
        return f.read()


def _mtime_date(path):
    return date.fromtimestamp(os.path.getmtime(path))


# ---------------------------------------------------------------- parsing

NOTE_RE = re.compile(r'^\((?![a-zA-Z0-9]{1,4}\)\s).*\)$')


def clean(fragment):
    text = re.sub(r'<[^>]*>', '', fragment)
    text = html.unescape(text).replace('\xa0', ' ')
    return re.sub(r'\s+', ' ', text).strip()


def parse_section(sid, page):
    """Parse an azleg ARS page. Returns {id, title, notes, paragraphs} or raises ValueError."""
    m = re.search(r'<title>(.*?)</title>', page, re.IGNORECASE | re.DOTALL)
    if not m:
        raise ValueError('no <TITLE>')
    head = clean(m.group(1))
    tm = re.match(r'^(\S+)\s+-\s+(.*)$', head)
    if not tm or tm.group(1) != sid:
        raise ValueError(f'unexpected page title {head!r}')
    title = tm.group(2).strip()

    paras = [clean(p) for p in re.findall(r'<p\b[^>]*>(.*?)</p>', page, re.IGNORECASE | re.DOTALL)]
    paras = [p for p in paras if p]
    # Heading paragraph: "16-579. Procedure for obtaining ballot by elector"
    if paras and re.match(rf'^{re.escape(sid)}\s?\.', paras[0]):
        paras = paras[1:]
    notes = []
    while paras and NOTE_RE.match(paras[0]):
        notes.append(paras.pop(0))
    return {'id': sid, 'title': title, 'notes': notes, 'paragraphs': paras}


# ---------------------------------------------------------------- main


def write_json(path, obj):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(obj, f, indent=2, ensure_ascii=False)
        f.write('\n')


def run(fetcher):
    seeds = seed_ids()
    print(f'{len(seeds)} sections cited by the manual, calendar, and ballot guide')
    sections, missing = {}, {}

    def fetch_all(ids):
        for i, sid in enumerate(ids, 1):
            if sid in sections or sid in missing:
                continue
            status, page, retrieved = fetcher.get(sid)
            if status != 'ok':
                missing[sid] = status
            else:
                try:
                    parsed = parse_section(sid, page)
                except ValueError as e:
                    missing[sid] = f'unparseable: {e}'
                    continue
                if not parsed['paragraphs']:
                    missing[sid] = 'blank or repealed'
                    continue
                sections[sid] = {
                    'id': sid,
                    'title': parsed['title'],
                    'url': id_to_url(sid),
                    'retrieved': retrieved.isoformat(),
                    'notes': parsed['notes'],
                    'paragraphs': parsed['paragraphs'],
                }
            if i % 50 == 0:
                print(f'  {i}/{len(ids)} ({fetcher.requests} requests)')

    fetch_all(sorted(seeds, key=sort_key))
    cross = []
    for sid in sorted(sections, key=sort_key):
        for ref in extract_section_refs('\n'.join(sections[sid]['paragraphs'])):
            if ref not in seeds and ref not in cross:
                cross.append(ref)
    print(f'{len(cross)} more Title 16/19 sections cross-referenced by those')
    fetch_all(sorted(cross, key=sort_key))

    os.makedirs(OUT_DIR, exist_ok=True)
    keep = {'index.json'} | {f'{sid}.json' for sid in sections}
    for name in os.listdir(OUT_DIR):
        if name.endswith('.json') and name not in keep:
            os.remove(os.path.join(OUT_DIR, name))
    for sid, sec in sections.items():
        write_json(os.path.join(OUT_DIR, f'{sid}.json'), sec)
    dates = [s['retrieved'] for s in sections.values()]
    write_json(os.path.join(OUT_DIR, 'index.json'), {
        'retrieved': min(dates) if dates else date.today().isoformat(),
        'source': SOURCE,
        'sections': {sid: sections[sid]['title'] for sid in sorted(sections, key=sort_key)},
        'missing': {sid: missing[sid] for sid in sorted(missing, key=sort_key)},
    })
    print(f'wrote {len(sections)} sections to {os.path.relpath(OUT_DIR, ROOT)}; '
          f'{len(missing)} missing; {fetcher.requests} network requests')
    for sid in sorted(missing, key=sort_key):
        print(f'  missing {sid}: {missing[sid]}')


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--refresh', action='store_true', help='ignore the cache and re-download')
    ap.add_argument('--offline', action='store_true', help='use only cached pages')
    args = ap.parse_args()
    run(Fetcher(refresh=args.refresh, offline=args.offline))


if __name__ == '__main__':
    main()
