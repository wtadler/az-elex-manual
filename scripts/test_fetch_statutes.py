"""Unit tests for scripts/fetch_statutes.py. Run: python3 -m unittest scripts/test_fetch_statutes.py"""

import os
import sys
import unittest

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

if __name__ == '__main__':
    unittest.main()
