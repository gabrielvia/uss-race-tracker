"""Audit complete-event discovery without silently dropping source rows."""
from copy import deepcopy
import unittest

from scripts.inspect_protocol import inventory_protocol

ROSTER = {"source_id": "test-source", "source_url": "https://example.test/source.pdf", "sha256": "a" * 64,
          "page_count": 2, "issues": [],
          "observations": [{"bib": str(i), "name": f"Skater {i}", "raw_name": f"Skater {i}"} for i in range(1, 5)]}
FIRST = """RESULTS
Group A Junior E Women's 700 Quarter-Finals Event #1
Heat 1 of 2 Race #101
1 1 Skater 1 Club One 1:20.000 Q
"""
SECOND = """RESULTS
Group A Junior E Women's 700 Quarter-Finals Event #1
Heat 2 of 2 Race #102
1 2 Skater 2 Club Two 1:19.000 Q
Group A Junior E Men's 700 Finals Event #2
A Final Race #201
1 3 Skater 3 Club Three 1:18.000
"""
PAGES = [(1, FIRST), (2, SECOND)]


class ProtocolInventoryTests(unittest.TestCase):
    def test_discovers_complete_events_across_physical_pages(self):
        report, extracted = inventory_protocol(PAGES, ROSTER)
        self.assertEqual(report["summary"], {"discovered_events": 2, "complete_selected_events": 2, "needs_review_events": 0, "export_eligible_events": 2})
        self.assertFalse(report["complete_competition"])
        self.assertEqual(report["events"][0]["pages"], [1, 2])
        self.assertEqual(report["events"][0]["observed_result_rows"], 2)
        self.assertEqual(report["events"][0]["heat_count"], 2)
        self.assertEqual(extracted[("1", "Group A Junior E Women's 700 Quarter-Finals Event #1")]["parser_version"], "tempus-complete-event/0.2")
        self.assertIsNone(report["coverage"]["published_events"])
        self.assertTrue(all(e["publication"] == "not_checked" for e in report["events"]))

    def test_classification_is_listed_separately(self):
        roster = {**ROSTER, "page_count": 3}
        report, extracted = inventory_protocol(PAGES + [(3, "CLASSIFICATION\nEvent #77\n1 3 Skater 3 99.000")], roster)
        self.assertEqual(report["page_kinds"]["classification"], [3])
        self.assertEqual(len(extracted), 2)
        self.assertEqual(report["summary"]["discovered_events"], 2)

    def test_missing_announced_heat_blocks_only_its_event(self):
        second = SECOND.split("Group A Junior E Men's")[1]
        report, extracted = inventory_protocol([(1, FIRST), (2, "RESULTS\nGroup A Junior E Men's" + second)], ROSTER)
        self.assertEqual(report["events"][0]["status"], "needs_review")
        self.assertIn("every announced heat", report["events"][0]["issues"][0]["message"])
        self.assertEqual(len(extracted), 1)

    def test_unassigned_continuation_prevents_unsafe_automatic_exports(self):
        roster = {**ROSTER, "page_count": 3}
        for text in ["RESULTS\n2 4 Skater 4 Club Four 1:22.000", "2 4 Skater 4 Club Four 1:22.000"]:
            with self.subTest(text=text):
                report, extracted = inventory_protocol(PAGES + [(3, text)], roster)
                self.assertTrue(report["source_issues"])
                self.assertEqual(extracted, {})
                self.assertTrue(all(not e["export_eligible"] for e in report["events"]))

    def test_unknown_status_row_is_detected_before_a_complete_claim(self):
        text = FIRST + "WD 4 Skater 4 Club Four\n"
        report, extracted = inventory_protocol([(1, text), (2, SECOND)], ROSTER)
        self.assertEqual(report["events"][0]["status"], "needs_review")
        self.assertIn("UNACCOUNTED_RESULT_ROWS", [i["code"] for i in report["events"][0]["issues"]])
        self.assertEqual(len(extracted), 1)

    def test_supported_statuses_stay_in_source_and_extracted_counts(self):
        for status in ["PEN", "DNS", "DNF", "DQ"]:
            with self.subTest(status=status):
                text = FIRST + f"4 Skater 4 Club Four {status}\n"
                report, extracted = inventory_protocol([(1, text), (2, SECOND)], ROSTER)
                event = extracted[("1", "Group A Junior E Women's 700 Quarter-Finals Event #1")]
                self.assertEqual(event["result_count"], 3)
                self.assertEqual(event["results"][1]["status_raw"], status)
                self.assertIsNone(event["results"][1]["time_microseconds"])
                self.assertEqual(report["events"][0]["observed_result_rows"], 3)

    def test_ambiguous_event_numbers_require_review(self):
        report, extracted = inventory_protocol([(1, FIRST), (2, SECOND.replace("Event #2", "Event #1"))], ROSTER)
        self.assertEqual(extracted, {})
        self.assertTrue(all("AMBIGUOUS_EVENT_NUMBER" in [i["code"] for i in e["issues"]] for e in report["events"]))

    def test_reused_race_ids_require_review(self):
        report, extracted = inventory_protocol([(1, FIRST), (2, SECOND.replace("Race #201", "Race #101"))], ROSTER)
        self.assertEqual(extracted, {})
        self.assertTrue(all("REUSED_RACE_ID" in [i["code"] for i in e["issues"]] for e in report["events"]))

    def test_unsupported_event_layout_is_retained_for_review(self):
        report, extracted = inventory_protocol([(1, FIRST), (2, SECOND.replace("Men's 700 Finals", "Men's 700 Preliminaries"))], ROSTER)
        self.assertEqual(report["summary"]["discovered_events"], 2)
        self.assertEqual(report["events"][1]["distance_metres"], None)
        self.assertIn("UNSUPPORTED_EVENT_LABEL", [i["code"] for i in report["events"][1]["issues"]])
        self.assertEqual(len(extracted), 1)

    def test_partial_scan_and_mixed_pages_never_silently_succeed(self):
        for pages, roster, code in [
            ([(2, SECOND)], ROSTER, "PARTIAL_PAGE_SCAN"),
            (PAGES + [(3, "RESULTS\nCLASSIFICATION")], {**ROSTER, "page_count": 3}, "MIXED_PAGE"),
            ([(1, "ROSTER"), (2, "ROSTER")], ROSTER, "NO_EVENT_TABLES"),
        ]:
            with self.subTest(code=code):
                report, extracted = inventory_protocol(pages, roster)
                self.assertIn(code, [i["code"] for i in report["source_issues"]])
                self.assertEqual(extracted, {})

    def test_raw_name_annotations_need_import_identity_review(self):
        roster = deepcopy(ROSTER)
        roster["observations"][0]["raw_name"] = "Skater 1 (Jr A)"
        first = FIRST.replace("Skater 1 Club One", "Skater 1 (Jr A) Club One")
        report, extracted = inventory_protocol([(1, first), (2, SECOND)], roster)
        event = report["events"][0]
        self.assertEqual(event["status"], "needs_review")
        self.assertEqual(event["parsed_result_rows"], 2)
        self.assertEqual(event["identity_review_rows"], 1)
        self.assertIn("IMPORT_IDENTITY_REVIEW", [i["code"] for i in event["issues"]])
        self.assertEqual(len(extracted), 1)

    def test_roster_issues_block_automatic_export(self):
        report, extracted = inventory_protocol(PAGES, {**ROSTER, "issues": ["Unparsed roster row"]})
        self.assertIn("ROSTER_ISSUES", [i["code"] for i in report["source_issues"]])
        self.assertEqual(extracted, {})

    def test_supplied_publication_evidence_is_checked_against_source_rows(self):
        _, extracted = inventory_protocol(PAGES, ROSTER)
        first = deepcopy(next(iter(extracted.values())))
        evidence = {"roster": ROSTER, "events": [first]}
        report, _ = inventory_protocol(PAGES, ROSTER, evidence)
        self.assertEqual([e["publication"] for e in report["events"]], ["published_verified", "not_published"])
        self.assertEqual(report["coverage"]["not_published_events"], 1)
        first["results"][0]["time_raw"] = "9:00.000"
        report, _ = inventory_protocol(PAGES, ROSTER, evidence)
        self.assertEqual(report["events"][0]["publication"], "published_needs_review")

    def test_legacy_publication_shape_and_unknown_published_event(self):
        _, extracted = inventory_protocol(PAGES, ROSTER)
        first = deepcopy(next(iter(extracted.values())))
        report, _ = inventory_protocol(PAGES, ROSTER, {"roster": ROSTER, "race": first})
        self.assertEqual(report["coverage"]["published_events"], 1)
        first["event_number"], first["event_label_raw"] = "99", "Unknown Finals Event #99"
        report, _ = inventory_protocol(PAGES, ROSTER, {"roster": ROSTER, "events": [first]})
        self.assertEqual(len(report["coverage"]["unknown_published_events"]), 1)

    def test_wrong_source_duplicate_evidence_and_invalid_page_sets_are_rejected(self):
        _, extracted = inventory_protocol(PAGES, ROSTER)
        first = deepcopy(next(iter(extracted.values())))
        for evidence in [{"roster": {**ROSTER, "sha256": "0" * 64}, "events": [first]},
                         {"roster": ROSTER, "events": [first, first]}, []]:
            with self.subTest(evidence_type=type(evidence).__name__), self.assertRaises(ValueError):
                inventory_protocol(PAGES, ROSTER, evidence)
        with self.assertRaises(ValueError):
            inventory_protocol(PAGES + [PAGES[0]], ROSTER)


if __name__ == "__main__":
    unittest.main()
