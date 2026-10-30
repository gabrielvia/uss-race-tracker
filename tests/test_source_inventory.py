import unittest

from scripts.source_inventory import build_inventory


def season_html(links):
    return '<div data-scope="accordion" data-part="item" id="collapsible:accordion::test::item:20252026">' + links + '</div>'


class InventoryTests(unittest.TestCase):
    def test_scopes_links_and_preserves_evidence(self):
        html = '<a href="/news">News</a>' + season_html('<h3>2025-2026</h3><img src="logo"><a href="/file.PDF"><strong>Results</strong> &amp; names</a>') + '<a href="/footer">Footer</a>'
        result = build_inventory(html, "2026-10-29T00:00:00+00:00")
        self.assertEqual(result["entry_count"], 1)
        entry = result["entries"][0]
        self.assertEqual(entry["title"], "Results & names")
        self.assertEqual(entry["format_hint"], "pdf")
        self.assertEqual(entry["season"], "2025-2026")
        self.assertEqual(entry["entry_url"], "https://www.usspeedskating.org/file.PDF")
        self.assertEqual(entry["status"], "discovered")
        self.assertIsNone(entry["event_date"])

    def test_flags_future_dates_without_rewriting_them(self):
        entry = build_inventory(season_html('<a href="/a.pdf">2027-09-27 - Championships</a>'), "2026-10-29T00:00:00+00:00")["entries"][0]
        self.assertEqual(entry["title_date"], "2027-09-27")
        self.assertIn("future_title_date_requires_verification", entry["issues"])
        self.assertIn("title_date_outside_season_requires_verification", entry["issues"])

    def test_history_page_requires_discovery(self):
        entry = build_inventory(season_html('<a href="/events/results/old">Old race</a>'), "2026-10-29T00:00:00+00:00")["entries"][0]
        self.assertIsNone(entry["file_url"])
        self.assertIn("requires_file_discovery", entry["issues"])

    def test_rejects_changed_or_empty_directory(self):
        with self.assertRaises(ValueError):
            build_inventory('<a href="/results">Results</a>', "2026-10-29T00:00:00+00:00")


if __name__ == "__main__":
    unittest.main()
