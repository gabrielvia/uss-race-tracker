"""Prepare, submit, inspect or explicitly publish a selected-events import batch."""
import argparse
from hashlib import sha256
import json
from pathlib import Path
import re
import sys
from urllib.error import HTTPError
from urllib.parse import urlsplit
from urllib.request import Request, build_opener

# Support both `python -m scripts.import_batch` and direct script execution.
if __package__:
    from .check_site import SameOriginRedirectHandler, credentials, validate_origin
    from .prepare_web_sample import prepare
else:
    from check_site import SameOriginRedirectHandler, credentials, validate_origin
    from prepare_web_sample import prepare

MAX_BYTES = 2 * 1024 * 1024


def prepare_candidate(item, pdf, reviewer, season_label, notes, base_batch_id=None):
    item = json.loads(json.dumps(item))
    item["source"].pop("objectKey", None)
    if "evidence" in item and "race" in item["evidence"] and "events" not in item["evidence"]:
        item["evidence"]["events"] = [item["evidence"].pop("race")]
    with Path(pdf).open("rb") as source:
        digest = sha256()
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    if digest.hexdigest() != item["source"]["sha256"]:
        raise ValueError("The local PDF does not match the extraction's source hash.")
    if not all(value.strip() for value in [reviewer, season_label, notes]):
        raise ValueError("Reviewer, original season label and review notes are required.")
    if base_batch_id is not None and not re.fullmatch(r"[a-f0-9]{64}", base_batch_id):
        raise ValueError("baseBatchId must be the current published batch ID.")
    return {"schemaVersion": 3, "coverage": "selected-events", "baseBatchId": base_batch_id,
            "review": {"reviewer": reviewer, "seasonSourceLabel": season_label, "notes": notes, "confirmed": True},
            "item": item}


def read_candidate(path):
    data = Path(path).read_bytes()
    if len(data) > MAX_BYTES:
        raise ValueError("Candidate exceeds the 2 MiB limit.")
    return json.loads(data)


def remote_request(origin, action, secret, candidate=None, batch_id=None, competition_id=None):
    origin = validate_origin(origin)
    if not secret.get("seed_token"):
        raise ValueError("A machine token is required.")
    if action == "head":
        if not competition_id or not re.fullmatch(r"[a-z0-9-]{1,80}", competition_id):
            raise ValueError("A valid competition ID is required.")
        path, method = "/api/imports?competition=" + competition_id, "GET"
    elif action == "submit":
        path, method = "/api/imports", "POST"
    else:
        if not batch_id or not re.fullmatch(r"[a-f0-9]{64}", batch_id):
            raise ValueError("A valid batch ID is required.")
        path = "/api/imports/" + batch_id + ("/publish" if action == "publish" else "")
        method = "POST" if action == "publish" else "GET"
    headers = {"Authorization": "Bearer " + secret["seed_token"], "Content-Type": "application/json"}
    if secret.get("service_token"):
        headers["OAI-Sites-Authorization"] = "Bearer " + secret["service_token"]
    data = json.dumps(candidate, ensure_ascii=False).encode() if action == "submit" else None
    if data is not None and len(data) > MAX_BYTES:
        raise ValueError("Candidate exceeds the 2 MiB limit.")
    request = Request(origin + path, data=data, headers=headers, method=method)
    opener = build_opener(SameOriginRedirectHandler())
    try:
        with opener.open(request, timeout=60) as response:
            return response.status, json.loads(response.read())
    except HTTPError as error:
        # Do not print HTML login pages or redirect targets that could carry secrets.
        try:
            result = json.loads(error.read())
        except (ValueError, UnicodeError):
            result = {"error": "The server returned a non-JSON response."}
        return error.code, result


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    actions = cli.add_subparsers(dest="action", required=True)
    make = actions.add_parser("prepare", help="Prepare an explicitly reviewed candidate; never publish it.")
    source = make.add_mutually_exclusive_group(required=True)
    source.add_argument("--competition", choices=["st-agn-2026", "lt-agn-2026"], help="Use a checked sample extraction.")
    source.add_argument("--item", type=Path, help="A normalized competition item with roster and complete selected events' evidence.")
    for name in ["pdf", "output"]:
        make.add_argument("--" + name, type=Path, required=True)
    for name in ["reviewer", "season-label", "notes"]:
        make.add_argument("--" + name, required=True)
    make.add_argument("--base-batch-id", help="Current published batch for a revision; omit for bootstrap adoption or a new competition.")
    for name in ["submit", "report", "publish", "head"]:
        action = actions.add_parser(name)
        action.add_argument("--url", required=True, help="The target bare HTTPS origin or loopback HTTP origin.")
        action.add_argument("--local-credentials", type=Path, help="Read ignored .dev.vars; restricted to loopback.")
        if name == "submit":
            action.add_argument("--candidate", type=Path, required=True)
        elif name == "head":
            action.add_argument("--competition", required=True)
        else:
            action.add_argument("--batch-id", required=True)
    args = cli.parse_args()
    try:
        if args.action == "prepare":
            item = json.loads(args.item.read_text()) if args.item else next(x for x in prepare()["competitions"] if x["competition"]["id"] == args.competition)
            candidate = prepare_candidate(item, args.pdf, args.reviewer, args.season_label, args.notes, args.base_batch_id)
            encoded = json.dumps(candidate, ensure_ascii=False, indent=2) + "\n"
            if len(encoded.encode()) > MAX_BYTES:
                raise ValueError("Candidate exceeds the 2 MiB limit.")
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(encoded, encoding="utf-8")
            print(json.dumps({"prepared": True, "path": str(args.output), "coverage": "selected-events", "published": False}))
            return 0
        origin = validate_origin(args.url)
        candidate = read_candidate(args.candidate) if args.action == "submit" else None
        if args.local_credentials:
            if urlsplit(origin).hostname not in {"localhost", "127.0.0.1", "::1"}:
                raise ValueError("--local-credentials is restricted to loopback URLs.")
            values = dict(line.split("=", 1) for line in args.local_credentials.read_text().splitlines() if "=" in line and not line.startswith("#"))
            secret = {"seed_token": values["SEED_TOKEN"].strip()}
        else:
            secret = credentials()
        status, result = remote_request(origin, args.action, secret, candidate, getattr(args, "batch_id", None), getattr(args, "competition", None))
        print(json.dumps({"httpStatus": status, "result": result}, ensure_ascii=False, indent=2))
        return 0 if 200 <= status < 300 else 1
    except (OSError, ValueError, KeyError, StopIteration) as error:
        # Never render network exceptions, request headers or credentials.
        print(f"Import operation failed ({type(error).__name__}). Check the inputs and connection.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
