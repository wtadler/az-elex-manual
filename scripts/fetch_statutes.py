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
retries with backoff on 5xx, 429, and timeouts (honoring Retry-After, up to 60s). A 403 means
we're likely blocked, so the run stops. Raw HTML is cached under .cache/azleg/ (gitignored), but
only pages whose <TITLE> is the section asked for, so an error page served with status 200 is
never cached. Reruns don't hit the server; --refresh ignores the cache, --offline never hits
the network. `retrieved` is the date the cached page was downloaded (its file mtime).

A bad run never wipes the committed dataset:
  - A 403, or network/HTTP failures (anything but a genuine 404) on more than 10% of sections,
    writes nothing and exits non-zero.
  - Under that, a section that failed keeps its existing JSON file and index entry.
  - --offline never prunes old files.

Standard library only, except pypdf for reading PDF link annotations when it is installed
(otherwise the PDF's streams are scanned directly).
"""

import argparse
import email.utils
import html
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
import zlib
from datetime import date, datetime, timezone

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
RETRIES = 4  # so up to 5 attempts
MAX_RETRY_AFTER = 60
TIMEOUT = 30
MAX_FAILURE_RATE = 0.10
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


class Blocked(Exception):
    """azleg.gov answered 403: we're probably blocked, so every later request would fail too."""


def is_failure(status):
    """True when a section couldn't be fetched for network/HTTP reasons, as opposed to 'ok' or a
    genuine 404 (the section doesn't exist). Failures say nothing about the section, so they
    mustn't replace or prune what's already in the dataset."""
    return status not in ('ok', '404')


def page_title_ok(sid, page):
    """True if the page's <TITLE> starts with '<sid> - ', i.e. it's the section we asked for and
    not an error or block page served with status 200."""
    m = re.search(r'<title>(.*?)</title>', page or '', re.IGNORECASE | re.DOTALL)
    return bool(m) and clean(m.group(1)).startswith(f'{sid} - ')


def retry_after_seconds(value, now=None):
    """Seconds to wait from a Retry-After header (delta-seconds or an HTTP date), capped at
    MAX_RETRY_AFTER. None if the header is missing or unparseable."""
    if not value:
        return None
    value = value.strip()
    if value.isdigit():
        seconds = int(value)
    else:
        try:
            when = email.utils.parsedate_to_datetime(value)
        except (TypeError, ValueError):
            return None
        if when is None:
            return None
        now = now or datetime.now(timezone.utc)
        if when.tzinfo is None:
            when = when.replace(tzinfo=timezone.utc)
        seconds = (when - now).total_seconds()
    return max(0, min(seconds, MAX_RETRY_AFTER))


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
        """Return (status, html_text_or_None, retrieved_date). status is 'ok' or a reason.

        Raises Blocked on a 403."""
        path = self.cache_path(sid)
        missing_marker = path + '.missing'
        if not self.refresh:
            # A cached page with the wrong title (an error page cached by an older version of
            # this script) is ignored and fetched again.
            if os.path.exists(path):
                page = _read(path)
                if page_title_ok(sid, page):
                    return 'ok', page, _mtime_date(path)
            elif os.path.exists(missing_marker):
                return _read(missing_marker).strip(), None, _mtime_date(missing_marker)
        if self.offline:
            return 'not cached (offline)', None, date.today()
        status, body = self._download(id_to_url(sid))
        if status == 'ok' and not page_title_ok(sid, body):
            status, body = 'unexpected page (not the section; error or block page?)', None
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
                if e.code == 403:
                    raise Blocked(f'{url} returned 403 Forbidden') from e
                if e.code < 500 and e.code != 429:
                    return str(e.code), None
                reason = str(e.code)
                retry_after = retry_after_seconds(e.headers.get('Retry-After') if e.headers else None)
            except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
                reason = f'network error: {getattr(e, "reason", e)}'
                retry_after = None
            if attempt < RETRIES:
                backoff = retry_after if retry_after is not None else 2 ** attempt
                print(f'  {url}: {reason}; retrying in {backoff:g}s', file=sys.stderr)
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


def _read_index():
    try:
        with open(os.path.join(OUT_DIR, 'index.json'), encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def run(fetcher):
    """Fetch, parse, and write the dataset. Returns the process exit code."""
    seeds = seed_ids()
    print(f'{len(seeds)} sections cited by the manual, calendar, and ballot guide')
    sections, missing, failed = {}, {}, {}

    def fetch_all(ids):
        for i, sid in enumerate(ids, 1):
            if sid in sections or sid in missing or sid in failed:
                continue
            status, page, retrieved = fetcher.get(sid)
            if is_failure(status):
                failed[sid] = status
            elif status != 'ok':
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

    out = os.path.relpath(OUT_DIR, ROOT)
    try:
        fetch_all(sorted(seeds, key=sort_key))
        cross = []
        for sid in sorted(sections, key=sort_key):
            for ref in extract_section_refs('\n'.join(sections[sid]['paragraphs'])):
                if ref not in seeds and ref not in cross:
                    cross.append(ref)
        print(f'{len(cross)} more Title 16/19 sections cross-referenced by those')
        fetch_all(sorted(cross, key=sort_key))
    except Blocked as e:
        print(f'error: {e}. azleg.gov is probably blocking this client, so the run stopped. '
              f'Nothing under {out} was changed.', file=sys.stderr)
        return 2

    attempted = len(sections) + len(missing) + len(failed)
    for sid in sorted(failed, key=sort_key):
        print(f'  failed {sid}: {failed[sid]}', file=sys.stderr)
    if attempted and len(failed) > MAX_FAILURE_RATE * attempted:
        print(f'error: {len(failed)} of {attempted} sections failed for network/HTTP reasons '
              f'(more than {MAX_FAILURE_RATE:.0%}). Nothing under {out} was changed; '
              f'fix the cause and rerun.', file=sys.stderr)
        return 1

    # A section that failed this time keeps whatever the dataset already had for it.
    old_titles = _read_index().get('sections', {})
    kept = {sid: old_titles[sid] for sid in failed
            if sid in old_titles and os.path.exists(os.path.join(OUT_DIR, f'{sid}.json'))}

    os.makedirs(OUT_DIR, exist_ok=True)
    if fetcher.offline:
        print('offline: not pruning old files')
    else:
        keep = {'index.json'} | {f'{sid}.json' for sid in [*sections, *kept]}
        for name in os.listdir(OUT_DIR):
            if name.endswith('.json') and name not in keep:
                os.remove(os.path.join(OUT_DIR, name))
    for sid, sec in sections.items():
        write_json(os.path.join(OUT_DIR, f'{sid}.json'), sec)
    titles = {**kept, **{sid: sec['title'] for sid, sec in sections.items()}}
    unresolved = {**missing, **{sid: reason for sid, reason in failed.items() if sid not in kept}}
    dates = [s['retrieved'] for s in sections.values()]
    write_json(os.path.join(OUT_DIR, 'index.json'), {
        'retrieved': min(dates) if dates else date.today().isoformat(),
        'source': SOURCE,
        'sections': {sid: titles[sid] for sid in sorted(titles, key=sort_key)},
        'missing': {sid: unresolved[sid] for sid in sorted(unresolved, key=sort_key)},
    })
    print(f'wrote {len(sections)} sections to {out}; kept {len(kept)} that failed to fetch; '
          f'{len(unresolved)} missing; {fetcher.requests} network requests')
    for sid in sorted(missing, key=sort_key):
        print(f'  missing {sid}: {missing[sid]}')
    return 0


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--refresh', action='store_true', help='ignore the cache and re-download')
    ap.add_argument('--offline', action='store_true', help='use only cached pages')
    args = ap.parse_args()
    sys.exit(run(Fetcher(refresh=args.refresh, offline=args.offline)))


if __name__ == '__main__':
    main()
