"""Test final-tier completeness, source states and a full protocol manifest."""
from copy import deepcopy
import unittest
from scripts.inspect_event import parse_event_pages
from scripts.prepare_protocol import assemble_protocol
from scripts.prepare_web_sample import prepare
from scripts.tempus_text import join_event_headings

ROSTER=[{"bib":"1","name":"Test One","raw_name":"Test One","affiliation_raw":"Test Club"}, {"bib":"2","name":"Test Two","raw_name":"Test Two","affiliation_raw":"Test Club"}]
TEXT="""RESULTS
Junior E Women's 500 Finals Event #1
B Final Race #101
1 1 Test One Test Club 0:55.000
A Final Race #102
1 2 Test Two Test Club 0:56.000
"""
class ProtocolCompletionTests(unittest.TestCase):
    def test_finals_keep_source_tiers_and_local_places_without_fabricated_classification(self):
        event=parse_event_pages([(1,TEXT)],ROSTER,"1")
        self.assertEqual(event['heat_count'],2)
        self.assertEqual([r['rank'] for r in event['results']],[1,1])
        self.assertEqual([r['race_label_raw'] for r in event['results']],["B Final Race #101","A Final Race #102"])
        for broken in [TEXT.replace('B Final','C Final'), TEXT.replace('B Final','A Final')]:
            with self.assertRaisesRegex(ValueError,'Final races'):
                parse_event_pages([(1,broken)],ROSTER,'1')
    def test_missing_finish_is_not_invented_as_a_status_or_zero(self):
        event=parse_event_pages([(1,TEXT.replace('0:55.000',''))],ROSTER,'1')
        r=event['results'][0]
        self.assertIsNone(r['time_microseconds']);self.assertIsNone(r['status_raw'])
        self.assertEqual(r['finish_note'],'Time not recorded in source.')
        self.assertEqual(r['rank'],1)
    def test_fnt_and_yc_are_retained_verbatim(self):
        for code in ['FNT','YC']:
            with self.subTest(code=code):
                r=parse_event_pages([(1,TEXT.replace('0:55.000',code))],ROSTER,'1')['results'][0]
                self.assertEqual(r['status_raw'],code);self.assertIsNone(r['time_microseconds'])
    def test_wrapped_title_requires_the_literal_following_line(self):
        text="RESULTS\nGroup A Junior Men's 1000 Semi- Event #1\nFinals\nHeat 1 of 1 Race #101\n1 1 Test One Test Club 0:55.000"
        event=parse_event_pages([(1,text)],ROSTER,'1')
        self.assertEqual(event['event_label_raw'],"Group A Junior Men's 1000 Semi-Finals Event #1")
        self.assertEqual(event['source_heading_lines'],["Group A Junior Men's 1000 Semi- Event #1","Finals"])
        self.assertEqual(join_event_headings(text.replace('\nFinals\n','\n'))[1],{})
    def test_full_manifest_retains_classifications_without_counting_them_as_results(self):
        sample=prepare()['competitions'][0];roster=deepcopy(sample['evidence']['roster'])
        roster.update(page_count=3,roster_pages=[1],observations=deepcopy(ROSTER),observation_count=2,distinct_bib_count=2)
        for o in roster['observations']:o.update(page=1,gender='Female',division_raw='Junior E Women',age_status_raw='JR E')
        roster_text='SKATER LIST\n# Name Status Gender Division Club\n1 Test One JR E Female Junior E Women Test Club\n2 Test Two JR E Female Junior E Women Test Club'
        report,item=assemble_protocol([(1,roster_text),(2,TEXT),(3,'Junior E Women\nDistance Classification\n1 1 Test One Test Club 10')],roster,sample['competition'])
        self.assertFalse(report['complete_competition'])
        self.assertEqual(len(item['results']),2)
        self.assertTrue(item['protocol']['complete_results'])
        self.assertEqual(item['protocol']['classifications'][0]['rows'][0]['bib'],'1')
        self.assertEqual(item['protocol']['classifications'][0]['kind'],'distance')
        self.assertEqual(item['protocol']['scanned_pages'],[1,2,3])
        report,bad=assemble_protocol([(1,roster_text+'\n3 Test Three JR E Female Junior E Women Test Club'),(2,TEXT),(3,'OVERALL CLASSIFICATION')],roster,sample['competition'])
        self.assertIsNone(bad)
        self.assertIn('ROSTER_SOURCE_ROWS',[i['code'] for i in report['source_issues']])
        report,item=assemble_protocol([(1,TEXT)],roster,sample['competition'])
        self.assertIsNone(item)
