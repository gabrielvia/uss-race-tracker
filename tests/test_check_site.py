import unittest
from io import BytesIO
from urllib.error import HTTPError
from urllib.request import Request

from scripts.check_site import SameOriginRedirectHandler, validate_origin


class RedirectTests(unittest.TestCase):
    def request(self):
        return Request("https://results.example/start", headers={
            "Authorization": "Bearer dummy-seed",
            "OAI-Sites-Authorization": "Bearer dummy-service",
        })

    def test_rejects_cross_host_redirect_before_forwarding_credentials(self):
        with self.assertRaises(HTTPError):
            SameOriginRedirectHandler().redirect_request(self.request(), BytesIO(), 302, "Found", {}, "https://other.example/target")

    def test_rejects_downgrade_and_changed_port(self):
        for target in ["http://results.example/target", "https://results.example:8443/target"]:
            with self.subTest(target=target), self.assertRaises(HTTPError):
                SameOriginRedirectHandler().redirect_request(self.request(), BytesIO(), 302, "Found", {}, target)

    def test_allows_same_origin_redirect_and_equivalent_default_port(self):
        redirected = SameOriginRedirectHandler().redirect_request(self.request(), BytesIO(), 302, "Found", {}, "https://results.example:443/target")
        self.assertEqual(redirected.get_header("Authorization"), "Bearer dummy-seed")
        self.assertEqual(redirected.get_header("Oai-sites-authorization"), "Bearer dummy-service")

    def test_loopback_cannot_redirect_to_external_origin(self):
        with self.assertRaises(HTTPError):
            SameOriginRedirectHandler().redirect_request(Request("http://127.0.0.1:5173/"), BytesIO(), 302, "Found", {}, "https://other.example/")

    def test_origin_rejects_cleartext_remote_userinfo_and_non_origins(self):
        for value in ["http://results.example", "https://user:secret@results.example", "file:///tmp/results", "https://results.example/path", "https://results.example?secret=1"]:
            with self.subTest(value=value), self.assertRaises(ValueError):
                validate_origin(value)
        self.assertEqual(validate_origin("http://127.0.0.1:5173/"), "http://127.0.0.1:5173")
