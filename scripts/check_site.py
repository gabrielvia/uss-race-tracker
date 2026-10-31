"""Seed and verify the minimal local or private Sites data slice."""
import argparse
import json
import sys
from urllib.error import HTTPError
from urllib.parse import urlsplit
from urllib.request import Request, HTTPRedirectHandler, build_opener


def origin_tuple(url):
    parts = urlsplit(url)
    if parts.scheme not in {"http", "https"} or not parts.hostname or parts.username is not None or parts.password is not None:
        raise ValueError("Use an HTTP(S) origin without embedded credentials.")
    port = parts.port if parts.port is not None else (443 if parts.scheme == "https" else 80)
    if not 1 <= port <= 65535:
        raise ValueError("Use a valid origin port.")
    return parts.scheme, parts.hostname.lower(), port


def validate_origin(url):
    scheme, host, _ = origin_tuple(url)
    parts = urlsplit(url)
    if parts.path not in {"", "/"} or parts.query or parts.fragment:
        raise ValueError("Use a bare origin without a path, query, or fragment.")
    if scheme != "https" and host not in {"localhost", "127.0.0.1", "::1"}:
        raise ValueError("Remote origins must use HTTPS.")
    return url.rstrip("/")


class SameOriginRedirectHandler(HTTPRedirectHandler):
    """Keep both service and seed credentials within the intended origin."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        try:
            same_origin = origin_tuple(req.full_url) == origin_tuple(newurl)
        except ValueError:
            same_origin = False
        if not same_origin:
            raise HTTPError(req.full_url, code, "Cross-origin redirect blocked.", headers, fp)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def credentials():
    previous = None
    if sys.stdin.isatty():
        import termios
        previous = termios.tcgetattr(sys.stdin)
        hidden = termios.tcgetattr(sys.stdin)
        hidden[3] &= ~termios.ECHO
        termios.tcsetattr(sys.stdin, termios.TCSANOW, hidden)
    print("Ready for site-check JSON on stdin (input is hidden).", flush=True)
    try:
        return json.loads(sys.stdin.readline())
    finally:
        if previous is not None:
            import termios
            termios.tcsetattr(sys.stdin, termios.TCSANOW, previous)


def check(origin, secret, read_only=False, legacy_sample=False, group_samples=False):
    if group_samples and (not read_only or legacy_sample):
        raise ValueError("Expanded group samples require read-only verification without --legacy-sample.")
    origin = validate_origin(origin)
    opener = build_opener(SameOriginRedirectHandler())
    def request(path, method="GET", seed_token=None):
        headers = {}
        if secret.get("service_token"):
            headers["OAI-Sites-Authorization"] = "Bearer " + secret["service_token"]
        if seed_token:
            headers["Authorization"] = "Bearer " + seed_token
        req = Request(origin.rstrip("/") + path, headers=headers, method=method)
        try:
            with opener.open(req, timeout=60) as response:
                content = response.read()
                return response.status, json.loads(content) if "application/json" in response.headers.get("Content-Type", "") else content.decode()
        except HTTPError as error:
            return error.code, error.read().decode()

    status, _ = request("/")
    assert status == 200, f"The page returned HTTP {status}"
    status, _ = request("/api/admin/seed", "POST")
    assert status == 401, f"Unauthenticated import returned HTTP {status}"
    if not read_only:
        for _ in range(2):
            status, data = request("/api/admin/seed", "POST", secret["seed_token"])
            assert status == 200 and data.get("seeded"), f"Sample import failed: HTTP {status}; use --read-only after validated publication"
    for path, method in [("/api/imports", "GET"), ("/api/imports", "POST"),
                         ("/api/imports/" + "0" * 64, "GET"),
                         ("/api/imports/" + "0" * 64 + "/publish", "POST")]:
        assert request(path, method)[0] == 401, "Ingestion must reject visitors without the machine token"
    if secret.get("seed_token"):
        status, head = request("/api/imports?competition=st-agn-2026", seed_token=secret["seed_token"])
        assert status == 200 and "baseBatchId" in head
    status, health = request("/api/health")
    assert status == 200 and health["ready"] and health["competitionCount"] == 2
    status, listing = request("/api/competitions")
    assert status == 200 and len(listing["competitions"]) == 2
    if __package__:
        from .prepare_web_sample import prepare
    else:
        from prepare_web_sample import prepare
    counts = {}
    for item in prepare(group_samples)["competitions"]:
        competition_id = item["competition"]["id"]
        expected_events = item["evidence"]["events"][:1] if legacy_sample else item["evidence"]["events"]
        expected_labels = {e["event_label_raw"] for e in expected_events}
        expected_rows = {r["id"]: r for r in item["results"] if r["eventLabel"] in expected_labels}
        status, detail = request("/api/competitions/" + competition_id)
        assert status == 200
        assert len(detail["participants"]) == len(item["participants"]), "Participant count changed"
        assert len(detail["entries"]) == len(item["entries"]), "Participation observations were lost or duplicated"
        assert len(detail["results"]) == len(expected_rows)
        assert detail["coverage"] == {"kind": "selected-events", "eventCount": len(expected_events), "completeCompetition": False}
        assert len(detail["events"]) == len(expected_events)
        for row in detail["results"]:
            expected = expected_rows[row["id"]]
            for actual_key, expected_key in [("event_label", "eventLabel"), ("time_raw", "timeRaw"), ("time_microseconds", "timeMicroseconds"),
                                             ("result_status", "status"), ("rank", "rank"), ("source_page", "sourcePage")]:
                assert row[actual_key] == expected[expected_key], f"A source result changed: {actual_key}"
        for event in detail["events"]:
            expected = next(e for e in expected_events if e["event_number"] == event["source_event_number"] and e["event_label_raw"] == event["label"])
            rows = [r for r in detail["results"] if r["event_key"] == event["id"]]
            assert event["label"] == expected["event_label_raw"]
            assert event["result_count"] == len(rows) == expected["result_count"]
            assert event["heat_count"] == len({r["race_id"] for r in rows}) == expected["heat_count"]
            assert all(r["event_label"] == event["label"] and r["distance"] == event["distance"] and r["round"] == event["round"] for r in rows)
            timed = [r for r in rows if r["result_status"] is None and r["time_microseconds"] is not None]
            assert rows[:len(timed)] == timed, "Status records preceded timed finishers"
            assert [r["time_microseconds"] for r in timed] == sorted(r["time_microseconds"] for r in timed)
        listed = next(c for c in listing["competitions"] if c["id"] == competition_id)
        assert listed["event_count"] == len(expected_events) and listed["result_count"] == len(expected_rows)
        status, evidence = request("/api/sources/" + detail["competition"]["source_id"])
        assert status == 200
        source_events = evidence.get("events") or [evidence["race"]]
        assert len(source_events) == len(expected_events)
        assert all(e["sha256"] == evidence["roster"]["sha256"] for e in source_events)
        assert {e["event_label_raw"] for e in source_events} == expected_labels
        for expected in expected_events:
            assert next(e for e in source_events if e["event_label_raw"] == expected["event_label_raw"]) == expected
        assert sum(e["result_count"] for e in source_events) == len(expected_rows)
        counts[competition_id] = {"participants": len(item["participants"]), "entries": len(item["entries"]), "results": len(expected_rows), "events": len(expected_events)}
    assert request("/api/competitions/not-a-competition")[0] == 404
    assert request("/api/sources/0000000000000000")[0] == 404
    print(json.dumps({"passed": True, "checks": ["page", "import_auth", "candidate_auth", "d1_queries", "event_isolation", "coverage", "r2_evidence", "missing_records"] + (["publication_head"] if secret.get("seed_token") else []) + ([] if read_only else ["repeat_import"]), "counts": counts}, indent=2))


if __name__ == "__main__":
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("--url", required=True)
    cli.add_argument("--legacy-sample", action="store_true", help="Verify the original one-event samples before expansion.")
    cli.add_argument("--group-samples", action="store_true", help="Verify the seven reviewed selected events, including repeated source numbers and raw age annotations; requires --read-only.")
    cli.add_argument("--read-only", action="store_true", help="Verify existing samples without re-running bootstrap.")
    cli.add_argument("--local-credentials", help="Read the ignored local .dev.vars file instead of stdin.")
    args = cli.parse_args()
    try:
        args.url = validate_origin(args.url)
        if args.local_credentials:
            from pathlib import Path
            if urlsplit(args.url).hostname not in {"localhost", "127.0.0.1", "::1"}:
                cli.error("--local-credentials is restricted to loopback URLs")
            values = dict(line.split("=", 1) for line in Path(args.local_credentials).read_text().splitlines() if "=" in line and not line.startswith("#"))
            secret = {"seed_token": values["SEED_TOKEN"].strip()}
        else:
            secret = credentials()
        check(args.url, secret, args.read_only, args.legacy_sample, args.group_samples)
    except Exception as error:
        print(f"Site verification failed: {type(error).__name__}: {error}", file=sys.stderr)
        sys.exit(1)
