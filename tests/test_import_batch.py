"""Exercise import preparation and credential transport boundaries."""
from hashlib import sha256
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from scripts.import_batch import prepare_candidate, read_candidate, remote_request, MAX_BYTES


class ImportBatchTests(unittest.TestCase):
    def test_pdf_hash_and_review_are_required(self):
        with tempfile.TemporaryDirectory() as folder:
            pdf = Path(folder) / "source.pdf"
            pdf.write_bytes(b"%PDF-test")
            item = {"source": {"sha256": sha256(pdf.read_bytes()).hexdigest(), "objectKey": "ignored"}}
            result = prepare_candidate(item, pdf, "Operator", "2025-2026", "Reviewed PDF")
            self.assertEqual(result["coverage"], "selected-events")
            self.assertIsNone(result["baseBatchId"])
            self.assertNotIn("objectKey", result["item"]["source"])
            self.assertIn("objectKey", item["source"])
            with self.assertRaises(ValueError):
                prepare_candidate(item, pdf, "", "2025-2026", "Reviewed PDF")
            pdf.write_bytes(b"changed")
            with self.assertRaises(ValueError):
                prepare_candidate(item, pdf, "Operator", "2025-2026", "Reviewed PDF")

    def test_stale_base_must_be_an_id(self):
        with tempfile.NamedTemporaryFile() as pdf:
            item = {"source": {"sha256": sha256(b"").hexdigest()}}
            with self.assertRaises(ValueError):
                prepare_candidate(item, pdf.name, "Operator", "2025-2026", "Reviewed", "invalid")

    def test_large_candidates_are_rejected_locally(self):
        with tempfile.NamedTemporaryFile() as candidate:
            candidate.write(b" " * (MAX_BYTES + 1))
            candidate.flush()
            with self.assertRaises(ValueError):
                read_candidate(candidate.name)

    def test_remote_http_is_rejected_before_transmitting_credentials(self):
        with patch("scripts.import_batch.build_opener") as opener:
            with self.assertRaises(ValueError):
                remote_request("http://example.com", "submit", {"seed_token": "test"}, {})
            opener.assert_not_called()

    def test_report_does_not_submit_or_publish(self):
        with patch("scripts.import_batch.build_opener") as opener:
            response = opener.return_value.open.return_value.__enter__.return_value
            response.status = 200
            response.read.return_value = json.dumps({"status": "validated"}).encode()
            status, result = remote_request("https://example.com", "report", {"seed_token": "test"}, batch_id="a" * 64)
            self.assertEqual(status, 200)
            self.assertEqual(result["status"], "validated")
            request = opener.return_value.open.call_args.args[0]
            self.assertEqual(request.method, "GET")
            self.assertIsNone(request.data)
            self.assertEqual(request.full_url, "https://example.com/api/imports/" + "a" * 64)


if __name__ == "__main__":
    unittest.main()
