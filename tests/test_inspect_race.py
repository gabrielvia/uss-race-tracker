import unittest
import json
from pathlib import Path

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

    def test_preserves_status_in_the_time_column_without_a_zero_time(self):
        for status in ["PEN", "DNS", "DNF", "DQ"]:
            with self.subTest(status=status):
                row = parse_race(TEXT.replace("1:20.448 Q", status), ROSTER, "101")[0]
                self.assertEqual(row["rank"], 1)
                self.assertEqual(row["status_raw"], status)
                self.assertIsNone(row["time_raw"])
                self.assertIsNone(row["time_microseconds"])
                self.assertIsNone(row["timing_decimal_places"])
                self.assertIsNone(row["qualification_raw"])
                self.assertEqual(row["affiliation_raw"], "Garden State")

    def test_preserves_status_in_place_of_rank_and_blank_places(self):
        for status in ["PEN", "DNS", "DNF", "DQ"]:
            for line in [f"{status} 185 Lindsay Lin Garden State", f"185 Lindsay Lin Garden State {status}"]:
                with self.subTest(line=line):
                    row = parse_race(TEXT.replace("1 185 Lindsay Lin Garden State 1:20.448 Q", line), ROSTER, "101")[0]
                    self.assertIsNone(row["rank"])
                    self.assertEqual(row["status_raw"], status)
                    self.assertEqual(row["row_raw"], line)
                    self.assertEqual(row["affiliation_raw"], "Garden State")
                    self.assertIsNone(row["time_microseconds"])

    def test_status_can_keep_a_recorded_time_and_qualification(self):
        row = parse_race(TEXT.replace("1:20.448 Q", "1:20.448 PEN Q"), ROSTER, "101")[0]
        self.assertEqual(row["status_raw"], "PEN")
        self.assertEqual(row["time_raw"], "1:20.448")
        self.assertEqual(row["time_microseconds"], 80_448_000)
        self.assertEqual(row["qualification_raw"], "Q")

    def test_unrecognized_finish_is_not_silently_dropped(self):
        with self.assertRaises(ValueError):
            parse_race(TEXT.replace("1:20.448 Q", "UNKNOWN"), ROSTER, "101")

    def test_real_protocol_status_rows_preserve_place_and_affiliation(self):
        fixture = json.loads((Path(__file__).parent / "fixtures/tempus-status-rows.json").read_text())
        for case in fixture["rows"]:
            with self.subTest(line=case["line"]):
                roster = [{"bib": case["bib"], "name": case["name"], "raw_name": case["name"]}]
                text = "RESULTS\nJunior E Women's 500 Finals Event #1\nFinals Race #101\n" + case["line"]
                row = parse_race(text, roster, "101")[0]
                self.assertEqual(row["bib"], case["bib"])
                self.assertEqual(row["rank"], case["rank"])
                self.assertEqual(row["status_raw"], case["status"])
                self.assertEqual(row["affiliation_raw"], case["affiliation"])
                self.assertIsNone(row["time_raw"])
                self.assertIsNone(row["time_microseconds"])


if __name__ == "__main__":
    unittest.main()
