import unittest
from scripts.prepare_web_sample import prepare, prepare_item
from copy import deepcopy


class WebSampleTests(unittest.TestCase):
    def test_imports_a_complete_round_with_heat_provenance(self):
        item = prepare()["competitions"][0]
        self.assertEqual(len(item["results"]), 53)
        self.assertEqual(len({r["eventKey"] for r in item["results"]}), 2)
        women = [r for r in item["results"] if "Women's" in r["eventLabel"]]
        men = [r for r in item["results"] if "Men's" in r["eventLabel"]]
        self.assertEqual(len(women), 14)
        self.assertEqual({r["heatNumber"] for r in women}, {1, 2, 3})
        self.assertEqual(len(men), 39)
        self.assertEqual({r["heatNumber"] for r in men}, set(range(1, 8)))
        self.assertEqual([r["status"] for r in men if r["status"]], ["PEN"])

    def test_preserves_participation_without_duplicating_people(self):
        sample = prepare()
        long_track = next(c for c in sample["competitions"] if c["competition"]["id"] == "lt-agn-2026")
        self.assertEqual(len(long_track["participants"]), 76)
        self.assertEqual(len(long_track["entries"]), 77)
        repeated = [e for e in long_track["entries"] if e["participantId"].endswith(":370")]
        self.assertEqual(len(repeated), 2)
        self.assertEqual(len({e["division"] for e in repeated}), 2)

    def test_times_and_sources_match_extraction_evidence(self):
        for item in prepare()["competitions"]:
            events = item["evidence"]["events"]
            self.assertTrue(all(item["source"]["sha256"] == event["sha256"] for event in events))
            people = {p["id"] for p in item["participants"]}
            originals = [r for event in events for r in event["results"]]
            self.assertEqual(len(item["results"]), len(originals))
            for result, original in zip(item["results"], originals):
                self.assertIn(result["participantId"], people)
                self.assertEqual(result["timeMicroseconds"], original["time_microseconds"])

    def test_assembler_rejects_duplicate_events_and_source_mismatch(self):
        item = prepare()["competitions"][0]
        events = deepcopy(item["evidence"]["events"])
        with self.assertRaisesRegex(ValueError, "selected twice"):
            prepare_item(item["competition"], item["evidence"]["roster"], [events[0], events[0]])
        events[1]["sha256"] = "0" * 64
        with self.assertRaisesRegex(ValueError, "source revision"):
            prepare_item(item["competition"], item["evidence"]["roster"], events)

    def test_group_samples_preserve_old_events_and_original_annotated_names(self):
        original = prepare()["competitions"]
        expanded = prepare(include_group_samples=True)["competitions"]
        self.assertEqual([len(i["results"]) for i in expanded], [67, 18])
        self.assertEqual([len(i["evidence"]["events"]) for i in expanded], [4, 3])
        for old, new in zip(original, expanded):
            self.assertEqual(new["results"][:len(old["results"])], old["results"])
            self.assertEqual(new["participants"], old["participants"])
        groups = [e for e in expanded[0]["evidence"]["events"] if e["event_number"] == "9"]
        self.assertEqual(len(groups), 2)
        self.assertEqual([e["result_count"] for e in groups], [10, 4])
        raw = expanded[1]["evidence"]["events"][-1]["results"][0]
        self.assertEqual(raw["name_raw"], "Keeley Whitcomb (Jr A)")
        self.assertIn(raw["name_raw"], raw["row_raw"])


if __name__ == "__main__":
    unittest.main()
