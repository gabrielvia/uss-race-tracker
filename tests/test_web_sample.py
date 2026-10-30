import unittest
from scripts.prepare_web_sample import prepare


class WebSampleTests(unittest.TestCase):
    def test_imports_a_complete_round_with_heat_provenance(self):
        item = prepare()["competitions"][0]
        self.assertEqual(len(item["results"]), 14)
        self.assertEqual({r["heatNumber"] for r in item["results"]}, {1, 2, 3})
        self.assertEqual(len({r["eventKey"] for r in item["results"]}), 1)
        self.assertTrue(all("Women's" in r["eventLabel"] for r in item["results"]))

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
            self.assertEqual(item["source"]["sha256"], item["evidence"]["race"]["sha256"])
            people = {p["id"] for p in item["participants"]}
            for result, original in zip(item["results"], item["evidence"]["race"]["results"]):
                self.assertIn(result["participantId"], people)
                self.assertEqual(result["timeMicroseconds"], original["time_microseconds"])


if __name__ == "__main__":
    unittest.main()
