#!/usr/bin/env python3
"""Parse the Chapter 15 election calendar (printed EPM pages 304-320) into src/data/calendar.json.

Usage: python3 scripts/parse_calendar.py [public/epm.pdf] [src/data/calendar.json]
Requires poppler's `pdftotext` (brew install poppler). Standard library only.

How it works: `pdftotext -bbox` gives every word with its coordinates. Each table row is
anchored by the date in the left column; the other cells are vertically centered on that
date. Lines in multi-line columns (event, reference, weekend note) are split among rows
so that each row's lines are tight and centered on its date (see assign_lines). The parser
fails loudly instead of guessing when a cell isn't centered or a code is unrecognized.
The footnote repeated on every calendar page goes to src/data/calendar-notes.json.

The output is verbatim, including the manual's own typos and four rows whose day counts
don't match their dates (listed in src/data/calendar.test.ts).
"""

import html
import json
import os
import re
import subprocess
import sys
from collections import Counter
from datetime import date

PDF_FIRST, PDF_LAST = 318, 334  # printed pages 304-320
PAGE_OFFSET = 14  # printed page N is PDF page N + 14

# Column boundaries (x in points), measured from the table header.
COLUMNS = [
    ('date', 0, 70),
    ('election', 70, 130),
    ('days', 130, 168),
    ('cat1', 168, 199),
    ('cat2', 199, 227),
    ('event', 227, 433),
    ('ref', 433, 512),
    ('weekend', 512, 9999),
]
HEADER_BOTTOM = 95
LINE_SPACING = 10.8  # lines within one cell are ~10.6pt apart; rows ~12pt or more
CENTER_TOLERANCE = 6  # cells are vertically centered on the row's date

DATE_RE = re.compile(r'^(\d{1,2})/(\d{1,2})/(\d{4})$')
WORD_RE = re.compile(
    r'xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)</word>'
)
OFFICE_ORDER = ['REC', 'BOS', 'ELEC', 'SOS', 'GOV']
OFFICES = set(OFFICE_ORDER)
ALL_OFFICES = ['REC', 'BOS', 'ELEC', 'SOS']  # what "ALL" expands to
SHORT_COLUMNS = {
    'election': re.compile(r'^([A-Z]+_[A-Z]+|ALL)$'),
    'days': re.compile(r'^[+-]?\d+$'),
    'cat1': re.compile(r'^[A-Z]{2,5}$'),
    'cat2': re.compile(r'^[A-Z]{2,5}$'),
}


def column(x):
    for name, lo, hi in COLUMNS:
        if lo <= x < hi:
            return name
    raise ValueError(x)


def read_pages(pdf):
    out = subprocess.run(
        ['pdftotext', '-f', str(PDF_FIRST), '-l', str(PDF_LAST), '-bbox', pdf, '-'],
        check=True, capture_output=True, text=True,
    ).stdout
    pages = re.split(r'<page ', out)[1:]
    for i, page in enumerate(pages):
        words = [
            (float(x0), float(y0), float(x1), float(y1), html.unescape(t))
            for x0, y0, x1, y1, t in WORD_RE.findall(page)
        ]
        yield PDF_FIRST + i, words


def footer_top(words):
    """Top of the footnote at the bottom of each page (starts with a non-date word at the left)."""
    ys = [y0 for x0, y0, _, _, t in words if x0 < 30 and y0 > 600 and not DATE_RE.match(t)]
    return min(ys) if ys else 760


def footnote(words):
    """The page's footnote text, without the calendar's own page counter at the end."""
    top = footer_top(words)
    text = ' '.join(t for _, t in lines_of([w for w in words if top - 1 <= w[1] < 760]))
    return re.sub(r'\s+\d+$', '', text)


def lines_of(words):
    """Group words into lines by y, sorted top to bottom, words left to right."""
    lines = []
    for w in sorted(words, key=lambda w: (round(w[1]), w[0])):
        if lines and abs(lines[-1][0] - w[1]) < 3:
            lines[-1][1].append(w)
        else:
            lines.append((w[1], [w]))
    return [(y, ' '.join(t for *_, t in sorted(ws))) for y, ws in lines]


def assign_lines(lines, anchors):
    """Split a column's lines into contiguous groups, one per row (possibly empty). A group
    costs its distance from being centered on the row's date, plus a penalty for every gap
    inside it wider than normal line spacing (so unrelated cells aren't lumped together).
    Returns (row index, group) pairs. Dynamic programming over (lines used, rows considered)."""
    n, m = len(lines), len(anchors)
    gap_cost = [0.0]  # gap_cost[k] = penalty for gaps between lines 0..k
    for a, b in zip(lines, lines[1:]):
        gap_cost.append(gap_cost[-1] + max(0.0, b[0] - a[0] - LINE_SPACING))
    INF = float('inf')
    best = [[INF] * (m + 1) for _ in range(n + 1)]
    back = [[None] * (m + 1) for _ in range(n + 1)]
    best[0][0] = 0
    for j in range(m):
        for i in range(n + 1):
            if best[i][j] == INF:
                continue
            if best[i][j] < best[i][j + 1]:  # row j gets no lines in this column
                best[i][j + 1], back[i][j + 1] = best[i][j], (i, None)
            for k in range(i + 1, n + 1):  # row j gets lines i..k-1
                center = (lines[i][0] + lines[k - 1][0]) / 2
                cost = best[i][j] + abs(center - anchors[j]) + gap_cost[k - 1] - gap_cost[i]
                if cost < best[k][j + 1]:
                    best[k][j + 1], back[k][j + 1] = cost, (i, j)
    groups, i, j = [], n, m
    while j > 0:
        prev_i, row = back[i][j]
        if row is not None:
            groups.append((row, lines[prev_i:i]))
        i, j = prev_i, j - 1
    return groups[::-1]


def join_lines(texts):
    out = ''
    for t in texts:
        if not out:
            out = t
        elif out.endswith('-') and not out.endswith(' -'):
            out += t  # "Post-" + "Election"
        else:
            out += ' ' + t
    return re.sub(r'\s+', ' ', out).strip()


def split_refs(texts):
    """Join a reference cell, repair line wraps ("16-" / "168(G)"), and split it wherever a
    new reference starts: a statute ("16-542(C)"), "Const.", "Procedures Manual", "MOVE Act"."""
    text = re.sub(r'\s+', ' ', ' '.join(texts)).strip()
    text = re.sub(r'(\d-) (\d)', r'\1\2', text)  # rejoin a statute wrapped as "16-" / "168(G)"
    if not text:
        return []
    return re.split(r' (?=\d{1,2}-\d|Const\.|Procedures Manual|MOVE Act)', text)


def parse_page(pdf_page, words):
    bottom = footer_top(words)
    body = [w for w in words if HEADER_BOTTOM < w[1] < bottom]
    anchors = []
    for x0, y0, _, y1, t in body:
        m = DATE_RE.match(t)
        if m and column(x0) == 'date':
            mo, d, yr = map(int, m.groups())
            anchors.append({'y': y0, 'date': date(yr, mo, d).isoformat()})
    anchors.sort(key=lambda a: a['y'])
    rows = [{**a, 'election': [], 'days': [], 'cats': [], 'event': [], 'ref': [], 'weekend': []}
            for a in anchors]

    def nearest(y):
        return min(rows, key=lambda r: abs(r['y'] - y))

    by_col = {}
    for w in body:
        col = column(w[0])
        # Some rows are one merged cell spanning the code/days/office columns; their words
        # don't look like codes, so they belong to the event text.
        if col in SHORT_COLUMNS and not SHORT_COLUMNS[col].match(w[4]):
            col = 'event'
        by_col.setdefault(col, []).append(w)

    for col, ws in by_col.items():
        if col == 'date':
            continue
        if col in ('election', 'days', 'cat1', 'cat2'):
            for x0, y0, _, y1, t in ws:
                row = nearest(y0)
                key = 'cats' if col.startswith('cat') else col
                row[key].append(t)
            continue
        for idx, block in assign_lines(lines_of(ws), [r['y'] for r in rows]):
            row = rows[idx]
            center = (block[0][0] + block[-1][0]) / 2
            if abs(row['y'] - center) > CENTER_TOLERANCE:
                raise ValueError(f'PDF page {pdf_page}: {col} block {block!r} is not centered on {row["date"]}')
            row[col].extend(t for _, t in block)

    entries = []
    for r in rows:
        # "ALL" in the office columns means the row applies to every office.
        cats = ALL_OFFICES if 'ALL' in r['cats'] else r['cats']
        offices = [c for c in cats if c in OFFICES]
        unknown = [c for c in cats if c not in OFFICES]
        if unknown:
            raise ValueError(f'PDF page {pdf_page} {r["date"]}: unknown office codes {unknown}')
        if len(r['election']) > 1 or len(r['days']) > 1:
            raise ValueError(f'PDF page {pdf_page} {r["date"]}: ambiguous {r["election"]} {r["days"]}')
        if not r['event']:
            raise ValueError(f'PDF page {pdf_page} {r["date"]}: no event text')
        code = r['election'][0] if r['election'] else None
        entries.append({
            'date': r['date'],
            'election': None if code in (None, 'ALL') else code,
            'daysFromElection': int(r['days'][0]) if r['days'] else None,
            'offices': offices,
            'event': join_lines(r['event']),
            'statutes': split_refs(r['ref']),
            'weekendNote': join_lines(r['weekend']) or None,
            'epmPage': pdf_page - PAGE_OFFSET,
        })
    return entries


def main():
    pdf = sys.argv[1] if len(sys.argv) > 1 else 'public/epm.pdf'
    out = sys.argv[2] if len(sys.argv) > 2 else 'src/data/calendar.json'
    notes_out = os.path.join(os.path.dirname(out), 'calendar-notes.json')
    entries, notes = [], set()
    for pdf_page, words in read_pages(pdf):
        entries.extend(parse_page(pdf_page, words))
        notes.add(footnote(words))
    if len(notes) != 1:
        raise ValueError(f'Calendar pages have different footnotes: {notes}')
    with open(notes_out, 'w') as f:
        json.dump({
            'footnote': notes.pop(),
            'epmPages': [PDF_FIRST - PAGE_OFFSET, PDF_LAST - PAGE_OFFSET],
        }, f, indent=2, ensure_ascii=False)
        f.write('\n')
    entries.sort(key=lambda e: e['date'])  # stable: keeps manual order within a date
    with open(out, 'w') as f:
        json.dump(entries, f, indent=2, ensure_ascii=False)
        f.write('\n')
    counts = Counter(e['election'] for e in entries)
    print(f'{len(entries)} rows -> {out}', dict(counts), file=sys.stderr)


if __name__ == '__main__':
    main()
