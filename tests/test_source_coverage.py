from copy import deepcopy
import unittest
from scripts.source_coverage import coverage
from scripts.source_inventory import build_inventory


class SourceCoverageTests(unittest.TestCase):
    def setUp(self):
        self.inventory = build_inventory('<div data-scope="accordion" data-part="item" id="x:item:20242025"><a href="/a.pdf">A</a><a href="/a.pdf">Alternate A</a><a href="/old">B</a></div>', '2026-11-03T19:00:00+00:00')
        e = self.inventory['entries'][0]
        self.report = dict(source_id=e['source_id'], source_url=e['entry_url'], sha256='a'*64,
                           pdf_page_count=3, scanned_page_count=3, source_issues=[],
                           summary=dict(discovered_events=2, complete_selected_events=2, needs_review_events=0, export_eligible_events=2))
        self.review = dict(sha256='a'*64, status='audited', checked_at='2026-11-03')

    def test_discovery_audit_and_publication_are_separate(self):
        data = coverage(self.inventory, [self.review], [self.report])
        self.assertEqual(data['directory']['entries'], 3)
        self.assertEqual(data['directory']['sources'], 2)
        self.assertEqual(data['audit']['auditedSources'], 1)
        self.assertEqual(data['audit']['pendingSources'], 1)
        self.assertNotIn('published', data)

    def test_partial_scans_and_source_issues_cannot_claim_a_complete_audit(self):
        for key, value in [('scanned_page_count', 2), ('source_issues', [{'code': 'UNSUPPORTED_RESULTS_PAGE'}])]:
            bad = {**self.report, key: value}
            with self.assertRaises(ValueError): coverage(self.inventory, [self.review], [bad])
            data = coverage(self.inventory, [{**self.review, 'status': 'needs-review'}], [bad])
            self.assertEqual(data['audit']['partlyParsedSources'], 1)
            self.assertEqual(data['audit']['auditedSources'], 0)

    def test_wrong_hash_url_and_duplicate_reviews_fail(self):
        for report in [{**self.report, 'sha256': 'b'*64}, {**self.report, 'source_url': 'https://example.test/other.pdf'}]:
            with self.assertRaises(ValueError): coverage(self.inventory, [self.review], [report])
        with self.assertRaises(ValueError): coverage(self.inventory, [self.review]*2, [self.report]*2)
