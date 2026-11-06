import json
from pathlib import Path
import unittest
from scripts.prepare_scanned_protocol import assemble, micros

REVIEW = json.loads(Path('data/samples/lt-amcup1-2027-source-review.json').read_text())

class ScannedProtocolTests(unittest.TestCase):
    def test_printed_precision_and_parenthetical_tie_digit_are_exact(self):
        self.assertEqual(micros('37.44(1)'), 37441000)
        self.assertEqual(micros('43.72(7)'), 43727000)
        self.assertEqual(micros('13:28.41'), 808410000)
        for value in ['37,44', '37.44(12)', '0:60.00', 'DNS']:
            with self.assertRaises(ValueError): micros(value)

    def test_official_source_rows_and_lap_times_are_not_repaired_or_inferred(self):
        item = assemble(REVIEW)
        self.assertEqual((len(item['participants']),len(item['results']),len(item['evidence']['events'])),(70,370,18))
        rows = [r for r in item['results'] if r['sourcePage']==6 and r['rank'] in [15,16]]
        self.assertEqual([(r['rank'],r['timeRaw']) for r in rows],[(15,'45.59'),(16,'45.57')])
        missing = next(r for r in item['results'] if r['sourcePage']==44 and r['participantId'].endswith(':112'))
        self.assertEqual(missing['distanceUnit'],'laps');self.assertEqual(missing['distance'],16)
        self.assertIsNone(missing['timeRaw']);self.assertEqual(missing['sourceFields']['Cum. Split'],'9:54.140')
        self.assertIsNone(missing['sourceFields']['Time'])
        self.assertTrue(all(p['affiliation']=='' and p['country'] for p in item['participants']))
        self.assertEqual(next(r for r in item['results'] if r['sourcePage']==50 and r['participantId'].endswith(':231'))['sourceNameRaw'],'LEO DROSSOS-THOMPSO')
