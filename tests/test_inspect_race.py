import unittest

from scripts.inspect_race import parse_race

ROSTER = [{"bib": "185", "raw_name": "Lindsay Lin", "name": "Lindsay Lin"}]
TEXT = """All Races
RESULTS
Group A Junior E Women's 700 Quarter-Finals Event #1
Heat 1 of 3 Race #101
# Name Affiliation Time Qual.
1 185 Lindsay Lin Garden State 1:20.448 Q
Heat 2 of 3 Race #102
1 999 Another Skater Another Club 1:00.000
"""


class RaceTests(unittest.TestCase):
    def test_keeps_exact_timing_and_selected_race_context(self):
        rows = parse_race(TEXT, ROSTER, "101")
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["time_microseconds"], 80_448_000)
        self.assertEqual(rows[0]["distance_metres"], 700)
        self.assertEqual(rows[0]["round_raw"], "Quarter-Finals")
        self.assertEqual(rows[0]["affiliation_raw"], "Garden State")

    def test_rejects_classification_tables(self):
        with self.assertRaises(ValueError):
            parse_race(TEXT.replace("RESULTS", "OVERALL CLASSIFICATION"), ROSTER, "101")

    def test_rejects_roster_mismatch(self):
        with self.assertRaises(ValueError):
            parse_race(TEXT, [], "101")

    def test_does_not_turn_non_finishes_into_times(self):
        with self.assertRaises(ValueError):
            parse_race(TEXT.replace("1:20.448 Q", "DNF"), ROSTER, "101")


if __name__ == "__main__":
    unittest.main()
