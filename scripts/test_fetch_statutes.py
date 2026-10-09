"""Unit tests for scripts/fetch_statutes.py. Run: python3 -m unittest scripts/test_fetch_statutes.py"""

import contextlib
import io
import json
import os
import sys
import tempfile
import unittest
import urllib.error
from datetime import datetime, timezone
from email.message import Message
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import fetch_statutes as fs  # noqa: E402

FIXTURES = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fixtures')


def fixture(name):
    with open(os.path.join(FIXTURES, name), encoding='utf-8') as f:
        return f.read()


class UrlIdTest(unittest.TestCase):
    def test_url_to_id(self):
        self.assertEqual(fs.url_to_id('https://www.azleg.gov/ars/16/00579.htm'), '16-579')
        self.assertEqual(fs.url_to_id('http://www.azleg.gov/ars/16/00121-01.htm'), '16-121.01')
        self.assertEqual(fs.url_to_id('https://www.azleg.gov/ars/9/00471.htm'), '9-471')
        self.assertEqual(fs.url_to_id('https://www.azleg.gov/ars/41/01001-02.htm'), '41-1001.02')

    def test_url_to_id_wrapped_and_typo_urls(self):
        self.assertEqual(
            fs.url_to_id('https://www.azleg.gov/viewdocument/?docName=https://www.azleg.gov/ars/16/00452.htm'),
            '16-452')
        self.assertEqual(fs.url_to_id('ttps://www.azleg.gov/ars/16/00168.htm'), '16-168')
        self.assertEqual(fs.url_to_id('HTTPS://WWW.AZLEG.GOV/ARS/16/00168.HTM'), '16-168')

    def test_url_to_id_rejects_non_ars(self):
        for url in ['https://www.azleg.gov/const/4/1.p1.htm',
                    'https://www.azleg.gov/arsDetail/?title=16',
                    'https://www.azleg.gov/legtext/56Leg/2R/laws/0002.pdf',
                    'https://azsos.gov/elections']:
            self.assertIsNone(fs.url_to_id(url), url)

    def test_id_to_url(self):
        self.assertEqual(fs.id_to_url('16-579'), 'https://www.azleg.gov/ars/16/00579.htm')
        self.assertEqual(fs.id_to_url('16-121.01'), 'https://www.azleg.gov/ars/16/00121-01.htm')
        self.assertEqual(fs.id_to_url('9-471'), 'https://www.azleg.gov/ars/9/00471.htm')
        self.assertEqual(fs.id_to_url('41-1001.02'), 'https://www.azleg.gov/ars/41/01001-02.htm')
        with self.assertRaises(ValueError):
            fs.id_to_url('Procedures Manual')

    def test_round_trip(self):
        for sid in ['16-579', '16-121.01', '9-471', '19-121.04', '41-1092.10', '1-303']:
            self.assertEqual(fs.url_to_id(fs.id_to_url(sid)), sid)

    def test_normalize(self):
        self.assertEqual(fs.normalize('16-542(C)'), '16-542')
        self.assertEqual(fs.normalize('19-121.01(A)'), '19-121.01')
        self.assertEqual(fs.normalize('16-579(A)(1)(a)'), '16-579')
        self.assertEqual(fs.normalize('16- 510(C)'), '16-510')
        self.assertEqual(fs.normalize('16-1005'), '16-1005')
        for ref in ['Procedures Manual', 'MOVE Act', 'Const. Art. 7, § 10', '2025-2026', '602-542-3333', '16-']:
            self.assertIsNone(fs.normalize(ref), ref)


class SortTest(unittest.TestCase):
    def test_numeric_order(self):
        ids = ['19-101', '16-122', '16-1005', '16-121.01', '9-471', '16-121', '16-121.02', '16-579',
               '41-1001.02', '16-121.10']
        self.assertEqual(sorted(ids, key=fs.sort_key), [
            '9-471', '16-121', '16-121.01', '16-121.02', '16-121.10', '16-122', '16-579',
            '16-1005', '19-101', '41-1001.02'])


class ArsRefTest(unittest.TestCase):
    def test_single(self):
        self.assertEqual(fs.extract_ars_refs('See A.R.S. § 16-579(A)(1).'), ['16-579'])
        self.assertEqual(fs.extract_ars_refs('A.R.S. § 16-121.01(A)-(B).'), ['16-121.01'])
        self.assertEqual(fs.extract_ars_refs('as allowed by A.R.S. 16-584.'), ['16-584'])

    def test_double_section_and_lists(self):
        self.assertEqual(fs.extract_ars_refs('A.R.S. §§ 16-121.01 and 16-122.'), ['16-121.01', '16-122'])
        self.assertEqual(fs.extract_ars_refs('A.R.S. §§ 16-121.01(C); 16-134(B); Ariz. Atty. Gen. Op.'),
                         ['16-121.01', '16-134'])
        self.assertEqual(fs.extract_ars_refs('A.R.S. § 16-608(A), A.R.S. § 16-616; and 11.'),
                         ['16-608', '16-616'])
        self.assertEqual(fs.extract_ars_refs('A.R.S. § 16-802 or § 16-804'), ['16-802', '16-804'])
        self.assertEqual(fs.extract_ars_refs('A.R.S. § 16-452(A), (B), and 16-453.'),
                         ['16-452', '16-453'])

    def test_ranges_include_both_ends_only(self):
        self.assertEqual(fs.extract_ars_refs('A.R.S. §§ 16-101 through 16-103.'), ['16-101', '16-103'])
        self.assertEqual(fs.extract_ars_refs('pursuant to A.R.S. § 16-661 through A.R.S. § 16-666 for'),
                         ['16-661', '16-666'])
        self.assertEqual(fs.extract_ars_refs('codified at A.R.S. §§ 16-901 to 16-938; and'),
                         ['16-901', '16-938'])

    def test_line_break_inside_ref(self):
        self.assertEqual(fs.extract_ars_refs('A.R.S. § 16-\n    510(C).'), ['16-510'])
        self.assertEqual(fs.extract_ars_refs('A.R.S. § 36- 333.01, A.R.S. § 36-333.02'),
                         ['36-333.01', '36-333.02'])

    def test_dedupes_in_first_seen_order(self):
        self.assertEqual(fs.extract_ars_refs('A.R.S. § 16-584(B). Later, A.R.S. § 16-579. Then § 16-584(E).'),
                         ['16-584', '16-579'])

    def test_no_false_positives(self):
        for text in ['the 2025-2026 election cycle', 'call 602-542-3333 for help',
                     'call (602) 542-3333', '52 U.S.C. § 21082(c).', '28 C.F.R. § 55.18(c)-(e)',
                     'on 11-05-2024', 'pages 16-18 of the manual', 'A.R.S. § 16- 14 The County']:
            self.assertEqual(fs.extract_ars_refs(text), [], text)

    def test_glued_footnote_numbers(self):
        # "§ 16-211" + period + footnote 12, at the end of a pdftotext paragraph.
        self.assertEqual(fs.extract_ars_refs('A.R.S. § 16-211.12 A minor who'), ['16-211'])
        self.assertEqual(fs.extract_ars_refs('A.R.S. § 16-449.1 A. Timeframe'), ['16-449'])
        # Real decimal section plus footnote 1.
        self.assertEqual(fs.extract_ars_refs('A.R.S. § 16-407.031 For elections'), ['16-407.03'])
        # A real decimal section followed by punctuation is untouched.
        self.assertEqual(fs.extract_ars_refs('A.R.S. § 16-121.01. The registrant'), ['16-121.01'])


class SectionRefTest(unittest.TestCase):
    def test_statute_text_refs(self):
        text = ('as prescribed by section 16-152, subsection A, paragraph 20 and proof as prescribed by '
                'section 16-123. Pursuant to sections 16-542 and 16-543, and section 19-121.01, subsection A.')
        self.assertEqual(fs.extract_section_refs(text), ['16-152', '16-123', '16-542', '16-543', '19-121.01'])

    def test_only_titles_16_and_19(self):
        text = 'as defined in section 14-5101 or section 41-1001.02 and section 16-584.'
        self.assertEqual(fs.extract_section_refs(text), ['16-584'])

    def test_section_list_with_commas(self):
        self.assertEqual(fs.extract_section_refs('Sections 16-101, 16-102 and 16-103 apply.'),
                         ['16-101', '16-102', '16-103'])

    def test_requires_section_word(self):
        self.assertEqual(fs.extract_section_refs('the 2025-2026 cycle and title 16, chapter 4'), [])


class ParseTest(unittest.TestCase):
    def test_caution_note(self):
        sec = fs.parse_section('16-579', fixture('16-579.htm'))
        self.assertEqual(sec['id'], '16-579')
        self.assertEqual(sec['title'], 'Procedure for obtaining ballot by elector')
        self.assertEqual(sec['notes'], ['(Caution: 1998 Prop. 105 applies)'])
        self.assertTrue(sec['paragraphs'][0].startswith('A. Every qualified elector, before receiving a ballot'))
        self.assertEqual(sec['paragraphs'][1], '1. The elector shall present any of the following:')
        self.assertTrue(sec['paragraphs'][2].startswith('(a) A valid form of identification'))
        self.assertTrue(any('conditional provisional ballot' in p for p in sec['paragraphs']))
        # Entities unescaped, no nbsp spacers, no stray whitespace or tags.
        self.assertTrue(any('"official election material"' in p for p in sec['paragraphs']))
        for p in sec['paragraphs']:
            self.assertNotIn('&', p.replace('& ', ''))
            self.assertNotIn('<', p)
            self.assertNotIn('\xa0', p)
            self.assertEqual(p, p.strip())
            self.assertNotIn('  ', p)
        self.assertNotIn('16-579.', sec['paragraphs'][0])

    def test_subsection_id(self):
        sec = fs.parse_section('16-121.01', fixture('16-121.01.htm'))
        self.assertEqual(sec['title'], 'Requirements for proper registration; violation; classification')
        self.assertEqual(sec['notes'], [])
        self.assertTrue(sec['paragraphs'][0].startswith('A. A person is presumed to be properly registered'))

    def test_short_section(self):
        sec = fs.parse_section('16-101', fixture('16-101.htm'))
        self.assertEqual(sec['title'], 'Qualifications of registrant; definition')
        self.assertEqual(sec['paragraphs'][0],
                         'A. Every resident of this state is qualified to register to vote if the resident:')
        self.assertTrue(sec['paragraphs'][-1].startswith('B. For the purposes of this title, "resident" means'))
        self.assertEqual(len(sec['paragraphs']), 8)

    def test_wrong_page_raises(self):
        with self.assertRaises(ValueError):
            fs.parse_section('16-580', fixture('16-579.htm'))
        with self.assertRaises(ValueError):
            fs.parse_section('16-999', '<html><head><title>Page not found</title></head></html>')

    def test_inline_markup_entities_and_spacers(self):
        page = ('<HTML><HEAD><TITLE>16-100 - Test &amp; title</TITLE></HEAD><BODY>'
                '<p><font color=GREEN>16-100.</font> <font color=PURPLE><u>Test &amp; title</u></font></p>'
                '<p>&nbsp;</p><p>(Caution:  test)</p><p>&nbsp;</p>'
                '<p>A. Some <b>bold</b>\n  text &quot;quoted&quot;&nbsp;here. </p>'
                '<p>(a) First item.</p><p></p><p>(L19, Ch. 1, sec. 2)</p></BODY></HTML>')
        sec = fs.parse_section('16-100', page)
        self.assertEqual(sec['title'], 'Test & title')
        self.assertEqual(sec['notes'], ['(Caution: test)'])
        # Trailing parenthetical paragraphs stay in paragraphs, in order.
        self.assertEqual(sec['paragraphs'], ['A. Some bold text "quoted" here.', '(a) First item.',
                                             '(L19, Ch. 1, sec. 2)'])

    def test_note_detection(self):
        self.assertTrue(fs.NOTE_RE.match('(Caution: 1998 Prop. 105 applies)'))
        self.assertFalse(fs.NOTE_RE.match('(a) First item.'))
        self.assertFalse(fs.NOTE_RE.match('(10) Tenth item (with aside)'))


# ---------------------------------------------------------------- fetching and writing (no network)


def page_for(sid, title='Test section', body='<p>A. Some text.</p>'):
    return (f'<HTML><HEAD><TITLE>{sid} - {title}</TITLE></HEAD><BODY>'
            f'<p>{sid}. {title}</p>{body}</BODY></HTML>')


def http_error(code, retry_after=None):
    headers = Message()
    if retry_after is not None:
        headers['Retry-After'] = retry_after
    return urllib.error.HTTPError('https://www.azleg.gov/x', code, 'err', headers, io.BytesIO(b''))


class FakeResponse:
    def __init__(self, body):
        self.body = body.encode('utf-8')

    def read(self):
        return self.body

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


class FakeAzleg:
    """Stands in for urllib.request.urlopen. `responses` maps a section id to a list of outcomes
    served in order (the last one repeats): a str is a 200 body, an int an HTTP error, an
    exception instance is raised. Ids not listed get a normal page."""

    def __init__(self, responses=None):
        self.responses = responses or {}
        self.calls = []

    def __call__(self, req, timeout=None):
        sid = fs.url_to_id(req.full_url)
        self.calls.append(sid)
        queue = self.responses.get(sid)
        if not queue:
            return FakeResponse(page_for(sid))
        outcome = queue.pop(0) if len(queue) > 1 else queue[0]
        if isinstance(outcome, BaseException):
            raise outcome
        if isinstance(outcome, int):
            raise http_error(outcome)
        if isinstance(outcome, tuple):
            raise http_error(*outcome)
        return FakeResponse(outcome)


class FetchTestCase(unittest.TestCase):
    """Points the cache and output at a temp dir and makes sleeps instant."""

    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.tmp = tmp.name
        self.out = os.path.join(self.tmp, 'statutes')
        self.cache = os.path.join(self.tmp, 'cache')
        for name, value in [('OUT_DIR', self.out), ('CACHE_DIR', self.cache), ('ROOT', self.tmp)]:
            patcher = mock.patch.object(fs, name, value)
            patcher.start()
            self.addCleanup(patcher.stop)
        sleep = mock.patch.object(fs.time, 'sleep')
        self.sleep = sleep.start()
        self.addCleanup(sleep.stop)
        quiet = mock.patch.object(sys, 'stderr', io.StringIO())  # retry messages
        quiet.start()
        self.addCleanup(quiet.stop)

    def use(self, fake):
        patcher = mock.patch.object(fs.urllib.request, 'urlopen', fake)
        patcher.start()
        self.addCleanup(patcher.stop)
        return fake

    def seed(self, ids):
        patcher = mock.patch.object(fs, 'seed_ids', lambda: {sid: {'test'} for sid in ids})
        patcher.start()
        self.addCleanup(patcher.stop)

    def run_quietly(self, **kwargs):
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()) as err:
            code = fs.run(fs.Fetcher(**kwargs))
        self.stderr = err.getvalue()
        return code

    def existing_dataset(self, ids):
        """Writes a committed-looking dataset for `ids` and returns a snapshot of it."""
        os.makedirs(self.out)
        for sid in ids:
            fs.write_json(os.path.join(self.out, f'{sid}.json'), {'id': sid, 'title': f'Old {sid}'})
        fs.write_json(os.path.join(self.out, 'index.json'), {
            'retrieved': '2026-01-01', 'source': fs.SOURCE,
            'sections': {sid: f'Old {sid}' for sid in ids}, 'missing': {}})
        return self.snapshot()

    def snapshot(self):
        files = {}
        for name in sorted(os.listdir(self.out)):
            with open(os.path.join(self.out, name), encoding='utf-8') as f:
                files[name] = f.read()
        return files

    def index(self):
        with open(os.path.join(self.out, 'index.json'), encoding='utf-8') as f:
            return json.load(f)


IDS = [f'16-{n}' for n in range(101, 121)]  # 20 sections


class RetryTest(FetchTestCase):
    def test_429_retries_honoring_retry_after(self):
        fake = self.use(FakeAzleg({'16-101': [(429, '7'), (429, '3'), page_for('16-101')]}))
        status, page, _ = fs.Fetcher().get('16-101')
        self.assertEqual(status, 'ok')
        self.assertEqual(fake.calls, ['16-101'] * 3)
        backoffs = [c.args[0] for c in self.sleep.call_args_list if c.args[0] >= 1]
        self.assertEqual(backoffs, [7, 3])

    def test_503_retries_and_caps_retry_after_at_60s(self):
        self.use(FakeAzleg({'16-101': [(503, '3600'), page_for('16-101')]}))
        status, _, _ = fs.Fetcher().get('16-101')
        self.assertEqual(status, 'ok')
        self.assertIn(mock.call(60), self.sleep.call_args_list)

    def test_429_without_retry_after_uses_exponential_backoff(self):
        self.use(FakeAzleg({'16-101': [429, 429, page_for('16-101')]}))
        status, _, _ = fs.Fetcher().get('16-101')
        self.assertEqual(status, 'ok')
        self.assertIn(mock.call(1), self.sleep.call_args_list)
        self.assertIn(mock.call(2), self.sleep.call_args_list)

    def test_gives_up_after_five_attempts(self):
        fake = self.use(FakeAzleg({'16-101': [429]}))
        status, page, _ = fs.Fetcher().get('16-101')
        self.assertEqual((status, page), ('429', None))
        self.assertEqual(len(fake.calls), 5)
        self.assertTrue(fs.is_failure(status))
        self.assertFalse(os.path.exists(fs.Fetcher().cache_path('16-101')))

    def test_network_errors_retry_and_count_as_failures(self):
        fake = self.use(FakeAzleg({'16-101': [urllib.error.URLError('down')]}))
        status, _, _ = fs.Fetcher().get('16-101')
        self.assertTrue(status.startswith('network error'))
        self.assertTrue(fs.is_failure(status))
        self.assertEqual(len(fake.calls), 5)

    def test_404_is_genuine_missing_and_cached(self):
        fake = self.use(FakeAzleg({'16-101': [404]}))
        status, _, _ = fs.Fetcher().get('16-101')
        self.assertEqual(status, '404')
        self.assertFalse(fs.is_failure(status))
        self.assertEqual(len(fake.calls), 1)
        self.assertEqual(fs.Fetcher().get('16-101')[0], '404')
        self.assertEqual(len(fake.calls), 1)  # served from the .missing marker

    def test_403_raises_blocked(self):
        fake = self.use(FakeAzleg({'16-101': [403]}))
        with self.assertRaises(fs.Blocked):
            fs.Fetcher().get('16-101')
        self.assertEqual(len(fake.calls), 1)


class RetryAfterTest(unittest.TestCase):
    def test_seconds(self):
        self.assertEqual(fs.retry_after_seconds('5'), 5)
        self.assertEqual(fs.retry_after_seconds(' 0 '), 0)
        self.assertEqual(fs.retry_after_seconds('600'), 60)

    def test_http_date(self):
        now = datetime(2026, 10, 9, 12, 0, 0, tzinfo=timezone.utc)
        self.assertEqual(fs.retry_after_seconds('Fri, 09 Oct 2026 12:00:20 GMT', now), 20)
        self.assertEqual(fs.retry_after_seconds('Fri, 09 Oct 2026 13:00:00 GMT', now), 60)
        self.assertEqual(fs.retry_after_seconds('Fri, 09 Oct 2026 11:00:00 GMT', now), 0)

    def test_missing_or_junk(self):
        for value in [None, '', 'soon', '-5']:
            self.assertIsNone(fs.retry_after_seconds(value), value)


class TitleCheckTest(FetchTestCase):
    def test_page_title_ok(self):
        self.assertTrue(fs.page_title_ok('16-579', fixture('16-579.htm')))
        self.assertFalse(fs.page_title_ok('16-57', fixture('16-579.htm')))
        self.assertFalse(fs.page_title_ok('16-580', fixture('16-579.htm')))
        self.assertFalse(fs.page_title_ok('16-579', '<html><title>Access denied</title></html>'))
        self.assertFalse(fs.page_title_ok('16-579', 'Rate limited'))
        self.assertFalse(fs.page_title_ok('16-579', None))

    def test_block_page_with_200_is_not_cached_and_is_a_failure(self):
        block = '<html><head><title>Request blocked</title></head><body>Try later</body></html>'
        fake = self.use(FakeAzleg({'16-579': [block, fixture('16-579.htm')]}))
        status, page, _ = fs.Fetcher().get('16-579')
        self.assertIsNone(page)
        self.assertTrue(fs.is_failure(status))
        self.assertNotIn('unparseable', status)
        path = fs.Fetcher().cache_path('16-579')
        self.assertFalse(os.path.exists(path))
        self.assertFalse(os.path.exists(path + '.missing'))
        # The next run fetches it again and gets the real page.
        status, page, _ = fs.Fetcher().get('16-579')
        self.assertEqual(status, 'ok')
        self.assertTrue(os.path.exists(path))
        self.assertEqual(len(fake.calls), 2)

    def test_previously_cached_error_page_is_refetched(self):
        path = fs.Fetcher().cache_path('16-579')
        os.makedirs(os.path.dirname(path))
        with open(path, 'w', encoding='utf-8') as f:
            f.write('<html><title>Service unavailable</title></html>')
        fake = self.use(FakeAzleg({'16-579': [fixture('16-579.htm')]}))
        status, _, _ = fs.Fetcher().get('16-579')
        self.assertEqual(status, 'ok')
        self.assertEqual(fake.calls, ['16-579'])
        self.assertTrue(fs.page_title_ok('16-579', fs._read(path)))

    def test_previously_cached_error_page_offline_is_a_failure(self):
        path = fs.Fetcher().cache_path('16-579')
        os.makedirs(os.path.dirname(path))
        with open(path, 'w', encoding='utf-8') as f:
            f.write('<html><title>Service unavailable</title></html>')
        fake = self.use(FakeAzleg())
        status, page, _ = fs.Fetcher(offline=True).get('16-579')
        self.assertIsNone(page)
        self.assertTrue(fs.is_failure(status))
        self.assertEqual(fake.calls, [])

    def test_good_cached_page_skips_the_network(self):
        fake = self.use(FakeAzleg())
        fs.Fetcher().get('16-101')
        fs.Fetcher().get('16-101')
        self.assertEqual(fake.calls, ['16-101'])


class RunSafetyTest(FetchTestCase):
    def test_clean_run_writes_and_prunes(self):
        before = self.existing_dataset(['16-101', '9-999'])
        self.assertIn('9-999.json', before)
        self.seed(IDS)
        self.use(FakeAzleg({'16-120': [404]}))
        self.assertEqual(self.run_quietly(), 0)
        files = self.snapshot()
        self.assertNotIn('9-999.json', files)  # no longer cited
        self.assertNotIn('16-120.json', files)
        self.assertEqual(len(self.index()['sections']), 19)
        self.assertEqual(self.index()['missing'], {'16-120': '404'})

    def test_over_10_percent_failures_changes_nothing_and_exits_nonzero(self):
        before = self.existing_dataset(IDS)
        self.seed(IDS)
        # 3 of 20 (15%) fail after retries.
        self.use(FakeAzleg({sid: [503] for sid in IDS[:3]}))
        self.assertEqual(self.run_quietly(), 1)
        self.assertEqual(self.snapshot(), before)
        self.assertIn('3 of 20 sections failed', self.stderr)
        self.assertIn('Nothing under', self.stderr)

    def test_genuine_404s_and_blank_pages_do_not_count_as_failures(self):
        self.existing_dataset(IDS)
        self.seed(IDS)
        blank = page_for('16-106', body='')
        self.use(FakeAzleg({**{sid: [404] for sid in IDS[:5]}, '16-106': [blank]}))
        self.assertEqual(self.run_quietly(), 0)
        missing = self.index()['missing']
        self.assertEqual(len(missing), 6)
        self.assertEqual(missing['16-106'], 'blank or repealed')
        self.assertNotIn('16-101.json', self.snapshot())

    def test_block_pages_with_200_count_as_failures(self):
        before = self.existing_dataset(IDS)
        self.seed(IDS)
        block = '<html><title>Pardon our interruption</title></html>'
        self.use(FakeAzleg({sid: [block] for sid in IDS[:4]}))
        self.assertEqual(self.run_quietly(), 1)
        self.assertEqual(self.snapshot(), before)

    def test_few_failures_keep_existing_files_and_index_entries(self):
        self.existing_dataset(IDS)
        self.seed(IDS)
        # 2 of 20 (10%) is at the limit, not over it.
        self.use(FakeAzleg({'16-101': [503], '16-102': [urllib.error.URLError('reset')]}))
        self.assertEqual(self.run_quietly(), 0)
        files = self.snapshot()
        self.assertEqual(json.loads(files['16-101.json'])['title'], 'Old 16-101')
        self.assertEqual(json.loads(files['16-102.json'])['title'], 'Old 16-102')
        self.assertEqual(json.loads(files['16-103.json'])['title'], 'Test section')
        index = self.index()
        self.assertEqual(index['sections']['16-101'], 'Old 16-101')
        self.assertEqual(index['sections']['16-102'], 'Old 16-102')
        self.assertNotIn('16-101', index['missing'])

    def test_failure_with_no_existing_copy_is_listed_missing(self):
        self.seed(IDS)
        self.use(FakeAzleg({'16-101': [503]}))
        self.assertEqual(self.run_quietly(), 0)
        self.assertEqual(self.index()['missing'], {'16-101': '503'})
        self.assertNotIn('16-101', self.index()['sections'])

    def test_403_stops_the_run_and_changes_nothing(self):
        before = self.existing_dataset(IDS)
        self.seed(IDS)
        fake = self.use(FakeAzleg({'16-103': [403]}))
        self.assertEqual(self.run_quietly(), 2)
        self.assertEqual(self.snapshot(), before)
        self.assertEqual(fake.calls, ['16-101', '16-102', '16-103'])  # nothing after the 403
        self.assertIn('403', self.stderr)

    def test_offline_with_an_empty_cache_changes_nothing(self):
        before = self.existing_dataset(IDS)
        self.seed(IDS)
        fake = self.use(FakeAzleg())
        self.assertEqual(self.run_quietly(offline=True), 1)
        self.assertEqual(self.snapshot(), before)
        self.assertEqual(fake.calls, [])

    def test_offline_never_prunes(self):
        self.existing_dataset(['16-101', '9-999'])
        self.seed(['16-101'])
        self.use(FakeAzleg())
        fs.Fetcher().get('16-101')  # warm the cache
        self.assertEqual(self.run_quietly(offline=True), 0)
        self.assertIn('9-999.json', self.snapshot())
        self.assertEqual(json.loads(self.snapshot()['16-101.json'])['title'], 'Test section')


if __name__ == '__main__':
    unittest.main()
