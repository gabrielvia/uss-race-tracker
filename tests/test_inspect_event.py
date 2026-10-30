import unittest
from scripts.inspect_event import parse_event_pages

ROSTER = [{"bib": str(i), "name": f"Skater {i}", "raw_name": f"Skater {i}"} for i in range(1, 5)]
TEXT = """RESULTS
Group A Junior E Women's 700 Quarter-Finals Event #1
Heat 1 of 2 Race #101
1 1 Skater 1 Club One 1:20.000 Q
Heat 2 of 2 Race #102
1 2 Skater 2 Club Two 1:19.000 Q
Group A Junior E Men's 700 Quarter-Finals Event #2
Heat 1 of 1 Race #201
1 3 Skater 3 Club Three 1:18.000 Q
Group A Junior E Women's 700 Semi-Finals Event #3
Heat 1 of 1 Race #301
1 4 Skater 4 Club Four 1:17.000 Q
"""


class EventTests(unittest.TestCase):
    def test_combines_heats_without_combining_gender_or_round(self):
        event = parse_event_pages([(75, TEXT)], ROSTER, "1")
        self.assertEqual(event["heat_count"], 2)
        self.assertEqual([r["bib"] for r in event["results"]], ["1", "2"])
        self.assertEqual([r["rank"] for r in event["results"]], [1, 1])
        self.assertEqual([r["heat_number"] for r in event["results"]], [1, 2])

    def test_refuses_incomplete_heats(self):
        with self.assertRaisesRegex(ValueError, "every announced heat"):
            parse_event_pages([(75, TEXT.split("Heat 2 of 2")[0])], ROSTER, "1")

    def test_refuses_same_event_number_for_different_groups(self):
        with self.assertRaisesRegex(ValueError, "different groups"):
            parse_event_pages([(75, TEXT.replace("Event #2", "Event #1"))], ROSTER, "1")

    def test_accepts_heats_on_separate_pages_with_repeated_event_heading(self):
        heading = "RESULTS\nGroup A Junior E Women's 700 Quarter-Finals Event #1\n"
        event = parse_event_pages([(75, heading + "Heat 1 of 2 Race #101\n1 1 Skater 1 Club One 1:20.000"),
                                   (76, heading + "Heat 2 of 2 Race #102\n1 2 Skater 2 Club Two 1:19.000")], ROSTER, "1")
        self.assertEqual([r["source_page"] for r in event["results"]], [75, 76])

    def test_rejects_untitled_continuation_after_all_heat_headers(self):
        first = TEXT.split("Group A Junior E Men's")[0]
        for continuation in ["RESULTS\n2 3 Skater 3 Club Three 1:21.000", "2 3 Skater 3 Club Three 1:21.000"]:
            with self.subTest(continuation=continuation), self.assertRaisesRegex(ValueError, "continuation"):
                parse_event_pages([(75, first), (76, continuation)], ROSTER, "1")

    def test_rejects_continuation_with_event_but_no_race_header(self):
        second = "RESULTS\nGroup A Junior E Women's 700 Quarter-Finals Event #1\n2 3 Skater 3 Club Three 1:21.000"
        with self.assertRaisesRegex(ValueError, "continuation"):
            parse_event_pages([(75, TEXT), (76, second)], ROSTER, "1")

    def test_rejects_split_race_with_repeated_heading(self):
        first = TEXT.split("Group A Junior E Men's")[0]
        second = "RESULTS\nGroup A Junior E Women's 700 Quarter-Finals Event #1\nHeat 2 of 2 Race #102\n2 3 Skater 3 Club Three 1:21.000"
        with self.assertRaisesRegex(ValueError, "continuation"):
            parse_event_pages([(75, first), (76, second)], ROSTER, "1")

    def test_rejects_race_heading_without_event_context(self):
        second = "RESULTS\nHeat 2 of 2 Race #102\n2 3 Skater 3 Club Three 1:21.000"
        with self.assertRaisesRegex(ValueError, "continuation"):
            parse_event_pages([(75, TEXT), (76, second)], ROSTER, "1")

    def test_status_rows_are_included_in_complete_event_counts(self):
        for status in ["PEN", "DNS", "DNF", "DQ"]:
            for line in [f"{status} 3 Skater 3 Club Three", f"3 Skater 3 Club Three {status}", f"2 3 Skater 3 Club Three {status}"]:
                with self.subTest(line=line):
                    text = TEXT.replace("Heat 2 of 2", line + "\nHeat 2 of 2", 1)
                    event = parse_event_pages([(75, text)], ROSTER, "1")
                    self.assertEqual(event["heat_count"], 2)
                    self.assertEqual(event["result_count"], 3)
                    self.assertEqual(event["heats"][0]["result_count"], 2)
                    self.assertEqual(event["results"][1]["status_raw"], status)
                    self.assertEqual(event["results"][1]["bib"], "3")

    def test_blank_place_status_on_an_unheaded_continuation_requires_review(self):
        for text in ["3 Skater 3 Club Three PEN", "RESULTS\n3 Skater 3 Club Three DNS"]:
            with self.subTest(text=text), self.assertRaisesRegex(ValueError, "continuation"):
                parse_event_pages([(75, TEXT), (76, text)], ROSTER, "1")
