"""Share exact-name and age-annotation edge cases with the server tests."""
import json
from pathlib import Path
import unittest

from scripts.tempus_identity import result_name_matches


class TempusIdentityTests(unittest.TestCase):
    def test_only_exact_evidenced_age_annotations_are_name_equivalents(self):
        cases = json.loads((Path(__file__).parent / "fixtures/tempus-name-cases.json").read_text())
        for case in cases:
            with self.subTest(case=case):
                self.assertEqual(result_name_matches(case["result"], case), case["valid"])
