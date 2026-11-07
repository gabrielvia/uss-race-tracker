"""Review or explicitly publish dimensions from an intact current protocol candidate.

The default is read-only. --publish creates a guarded replacement publication;
original candidates, result IDs, source evidence and publication history remain intact.
Credentials use hidden stdin, or a loopback-only local credential file.
"""
import argparse
from hashlib import sha256
import json
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import Request, build_opener
from .check_site import SameOriginRedirectHandler, credentials, validate_origin
from .competition_dimensions import dimensions, REVIEWED_SOURCES, VERSION
from .import_batch import remote_request
from .check_protocol import check_protocol


def backfill(origin, secret, competition, reviewer, publish=False):
    opener = build_opener(SameOriginRedirectHandler())

    def get(path, machine=False, binary=False):
        headers = {}
        if secret.get("service_token"):
            headers["OAI-Sites-Authorization"] = "Bearer " + secret["service_token"]
        if machine:
            headers["Authorization"] = "Bearer " + secret["seed_token"]
        with opener.open(Request(origin + path, headers=headers), timeout=60) as response:
            data = response.read()
            return data if binary else json.loads(data)

    status, head = remote_request(origin, "head", secret, competition_id=competition)
    assert status == 200 and head["baseBatchId"], "A current publication is required."
    old_id = head["baseBatchId"]
    candidate = get(f"/api/imports/{old_id}?candidate=1", True)
    item = candidate["item"]
    assert item["source"]["sha256"] in REVIEWED_SOURCES, "This source revision requires a separate dimension review."
    assert item.get("protocol"), "Backfill requires the preserved full protocol candidate."
    before = get("/api/competitions/" + competition)
    old_history = get("/api/imports?history=1&competition=" + competition, True)
    assert sha256(get(before["archivedPdf"], binary=True)).hexdigest() == item["source"]["sha256"]
    mapped = dimensions(item)
    assert all(r["status"] == "source-mapped" for r in mapped["results"]), "Resolve unknown scope before this reviewed backfill."
    already = item.get("dimensions") == mapped
    summary = {"competition": competition, "version": VERSION, "events": len(mapped["events"]), "entries": len(mapped["entries"]), "results": len(mapped["results"]), "unresolved": 0, "baseBatchId": old_id, "published": False}
    if not publish:
        return summary
    if not already:
        item["dimensions"] = mapped
        candidate["baseBatchId"] = old_id
        candidate["review"] = {"reviewer": reviewer, "seasonSourceLabel": candidate["review"]["seasonSourceLabel"], "confirmed": True,
                               "notes": "Reviewed exact source headings, roster gender and applicable entry divisions under tempus-agn-dimensions/1. Mixed Master events and Group A/B remain distinct. All original events, races, results, roster observations and classification evidence are retained."}
        status, batch = remote_request(origin, "submit", secret, candidate=candidate)
        assert status == 200 and batch["report"]["valid"], "Backfill candidate failed current validation."
        assert batch["report"]["validationVersion"] == "competition-events/18"
        status, result = remote_request(origin, "publish", secret, batch_id=batch["id"])
        assert status == 200 and result["active"], "Publication failed or the current head changed."
        summary["batchId"] = batch["id"]
    else:
        summary["batchId"] = old_id
    after = get("/api/competitions/" + competition)
    new_columns = {"entry_id", "gender", "division_key", "scope_status"}
    for key in ["results", "participants", "entries"]:
        project = lambda rows: {r["id"]: {k: v for k, v in r.items() if k not in new_columns} for r in rows}
        assert project(before[key]) == project(after[key]), "An original projection field changed."
    expected = {r["id"]: r for r in mapped["results"]}
    for row in after["results"]:
        d = expected[row["id"]]
        assert (row["entry_id"], row["gender"], row["division_key"], row["scope_status"]) == (d["entryId"], d["gender"], d["division"], d["status"])
    assert {e["id"] for e in before["events"]} == {e["id"] for e in after["events"]}
    history = get("/api/imports?history=1&competition=" + competition, True)
    assert history["total"] >= old_history["total"]
    check_protocol(origin, secret, item)
    summary.update({"published": True, "readBackVerified": True, "originalFieldsPreserved": True})
    return summary


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("--url", required=True)
    cli.add_argument("--competition", required=True, choices=["st-agn-2026", "lt-agn-2026"])
    cli.add_argument("--reviewer", required=True)
    cli.add_argument("--publish", action="store_true")
    cli.add_argument("--local-credentials", type=Path)
    cli.add_argument("--report", type=Path)
    args = cli.parse_args()
    origin = validate_origin(args.url)
    if not args.reviewer.strip():
        cli.error("A reviewer is required.")
    if args.local_credentials:
        if urlsplit(origin).hostname not in {"localhost", "127.0.0.1", "::1"}:
            cli.error("Local credentials are restricted to loopback.")
        values = dict(line.split("=", 1) for line in args.local_credentials.read_text().splitlines() if "=" in line and not line.startswith("#"))
        secret = {"seed_token": values["SEED_TOKEN"].strip()}
    else:
        secret = credentials()
    summary = backfill(origin, secret, args.competition, args.reviewer, args.publish)
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(summary, indent=2) + "\n")
    print(json.dumps(summary), flush=True)


if __name__ == "__main__":
    main()
