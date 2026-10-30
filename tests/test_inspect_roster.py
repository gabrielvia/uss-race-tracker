import unittest

from scripts.inspect_roster import parse_roster_words


def row_words(values, y):
    return [{"text": text, "x0": x, "top": y} for x, text in values]


class RosterTests(unittest.TestCase):
    def test_long_track_age_suffix_and_direct_affiliation(self):
        words = row_words([(10, "#"), (40, "Name"), (220, "Gender"), (280, "Division"), (420, "Club")], 20)
        words += row_words([(3, "370"), (40, "Andrea"), (80, "Sudjapun"), (140, "(Master"), (175, "W"), (190, "40-44)"), (220, "Female"), (280, "Combined"), (420, "Direct")], 40)
        rows, issues = parse_roster_words(words, 3)
        self.assertEqual(issues, [])
        self.assertEqual(rows[0]["name"], "Andrea Sudjapun")
        self.assertEqual(rows[0]["age_status_raw"], "Master W 40-44")
        self.assertIsNone(rows[0]["club_name"])
        self.assertEqual(rows[0]["page"], 3)

    def test_division_is_not_automatically_an_age(self):
        words = row_words([(10, "#"), (40, "Name"), (220, "Gender"), (280, "Division"), (420, "Club")], 20)
        words += row_words([(10, "77"), (40, "Ethan"), (90, "Liu"), (220, "Male"), (280, "DeClemente"), (420, "Garden"), (465, "State")], 40)
        rows, issues = parse_roster_words(words, 3)
        self.assertFalse(issues)
        self.assertIsNone(rows[0]["age_status_raw"])
        self.assertEqual(rows[0]["age_evidence_type"], "unresolved_division")

    def test_does_not_silently_drop_bad_rows(self):
        words = row_words([(10, "#"), (40, "Name"), (220, "Gender"), (280, "Division"), (420, "Club")], 20)
        words += row_words([(10, "10"), (40, "Incomplete")], 40)
        rows, issues = parse_roster_words(words, 3)
        self.assertEqual(rows, [])
        self.assertEqual(issues[0]["reason"], "unparsed_roster_row")


if __name__ == "__main__":
    unittest.main()
