"""Read-only exact PB verification for the checked competition-local AGN corpus."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from collections import defaultdict
import json
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import Request, build_opener
from .check_site import SameOriginRedirectHandler, credentials, validate_origin


def check_personal_bests(origin, secret, items):
    cases = []
    for item in items:
        by_person = defaultdict(list)
        for result in item["results"]:
            by_person[result["participantId"]].append(result)
        for person in item["participants"]:
            cases.append((item, person, by_person[person["id"]]))

    def check(case):
        item, person, rows = case
        headers = {"OAI-Sites-Authorization": "Bearer " + secret["service_token"]} if secret.get("service_token") else {}
        opener = build_opener(SameOriginRedirectHandler())
        with opener.open(Request(origin + "/api/participants/" + person["id"] + "/personal-bests", headers=headers), timeout=45) as response:
            data = json.load(response)
        assert data["participantId"] == person["id"]
        assert data["identityStatus"] == "competition-local", "This corpus verifier expects the checked unmerged identities."
        assert data["seasonScope"] == "all-published-seasons" and data["basis"] == "published-results"
        eligible = [r for r in rows if r["status"] is None and r["timeMicroseconds"] is not None and r["timeMicroseconds"] > 0]
        assert data["coverage"]["recorded_result_count"] == len(rows)
        assert data["coverage"]["comparable_result_count"] == len(eligible)
        distances = {r["distance"] for r in eligible}
        bests = data["personalBests"]
        assert len(bests) == len(distances) and {b["distance"] for b in bests} == distances
        for best in bests:
            minimum = min(r["timeMicroseconds"] for r in eligible if r["distance"] == best["distance"])
            expected = {r["id"]: r for r in eligible if r["distance"] == best["distance"] and r["timeMicroseconds"] == minimum}
            assert best["discipline"] == item["competition"]["discipline"] and best["time_microseconds"] == minimum
            assert {r["id"] for r in best["performances"]} == set(expected)
            for row in best["performances"]:
                source = expected[row["id"]]
                assert row["participant_id"] == person["id"] and row["competition_id"] == item["competition"]["id"]
                assert row["source_url"] == item["source"]["url"] and row["source_page"] == source["sourcePage"]
                assert row["time_raw"] == source["timeRaw"] and row["result_status"] is None
                assert row["event_key"] == source["eventKey"] and row["race_id"] == source["raceId"]
        return len(bests)

    with ThreadPoolExecutor(max_workers=6) as pool:
        counts = list(pool.map(check, cases))
    return {"passed": True, "readOnly": True, "profiles": len(cases), "personalBests": sum(counts), "sourcePerformancesVerified": True, "allPublishedSeasons": True, "groupedByDisciplineAndDistance": True}


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("--url", required=True)
    cli.add_argument("--item", action="append", type=Path, required=True)
    cli.add_argument("--report", type=Path)
    args = cli.parse_args()
    origin = validate_origin(args.url)
    secret = {} if urlsplit(origin).hostname in {"localhost", "127.0.0.1", "::1"} else credentials()
    result = check_personal_bests(origin, secret, [json.loads(p.read_text()) for p in args.item])
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result), flush=True)


if __name__ == "__main__":
    main()
