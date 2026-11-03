"""Read-only chart query/source conformance for the checked unmerged AGN corpus."""
import argparse
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, build_opener
from .check_site import SameOriginRedirectHandler, credentials, validate_origin


def check_performances(origin, secret, items):
    def get(params):
        headers = {"OAI-Sites-Authorization": "Bearer " + secret["service_token"]} if secret.get("service_token") else {}
        opener = build_opener(SameOriginRedirectHandler())
        with opener.open(Request(origin + "/api/performances?" + urlencode(params, doseq=True), headers=headers), timeout=45) as response:
            return json.load(response)

    cases = []
    for item in items:
        people = item["participants"]
        for start in range(0, len(people), 4):
            selected = [p["id"] for p in people[start:start + 4]]
            rows = [r for r in item["results"] if r["participantId"] in selected]
            for distance in sorted({r["distance"] for r in rows}):
                cases.append((item, selected, distance, [r for r in rows if r["distance"] == distance]))

    def check(case):
        item, people, distance, expected_rows = case
        params = {"participant": people, "discipline": item["competition"]["discipline"], "distance": distance}
        data = get(params)
        assert not data["selectionRequired"] and data["trackSpecification"] is None
        assert [s["id"] for s in data["series"]] == people
        assert all(s["identity_status"] == "competition-local" for s in data["series"])
        expected = {r["id"]: r for r in expected_rows}
        assert len(data["records"]) == len(expected)
        assert {r["id"] for r in data["records"]} == set(expected)
        comparable = 0
        groups = defaultdict(list)
        fields = {"participant_id": "participantId", "race_id": "raceId", "distance": "distance", "round": "round", "rank": "rank", "result_status": "status", "time_microseconds": "timeMicroseconds", "time_raw": "timeRaw", "qualification": "qualification", "source_page": "sourcePage", "event_key": "eventKey", "event_label": "eventLabel", "race_label": "raceLabel", "heat_number": "heatNumber", "heat_total": "heatTotal"}
        for row in data["records"]:
            source = expected[row["id"]]
            for key, source_key in fields.items():
                assert row[key] == source[source_key], (row["id"], key)
            assert row["series_id"] == source["participantId"]
            assert row["discipline"] == item["competition"]["discipline"]
            assert row["source_url"] == item["source"]["url"]
            assert row["starts_on"] == item["competition"]["startsOn"]
            assert row["ends_on"] == item["competition"]["endsOn"]
            if source["status"] is None and source["timeMicroseconds"] is not None and source["timeMicroseconds"] > 0:
                comparable += 1
                groups[(row["series_id"], row["competition_id"])].append(row)
        best = sum(sum(r["time_microseconds"] == min(x["time_microseconds"] for x in rows) for r in rows) for rows in groups.values())
        assert len(data["competitionBests"]) == len(groups)
        seen = set()
        for point in data["competitionBests"]:
            key = (point["series_id"], point["competition_id"])
            assert key not in seen
            seen.add(key)
            rows = groups[key]
            minimum = min(r["time_microseconds"] for r in rows)
            ties = sorted((r for r in rows if r["time_microseconds"] == minimum), key=lambda r: r["id"])
            assert point["time_microseconds"] == minimum
            assert point["id"] == ties[0]["id"]
            assert point["performances"] == ties
        # Endpoint overlap must include the last evidenced competition day.
        if expected_rows and case == cases[0]:
            overlap = get({**params, "from": item["competition"]["endsOn"], "to": item["competition"]["endsOn"]})
            assert {r["id"] for r in overlap["records"]} == set(expected)
            legacy = get({**params, "round": "No matching round"})
            assert legacy["competitionBests"] == data["competitionBests"]
        return len(expected), comparable, best, len(groups)

    with ThreadPoolExecutor(max_workers=6) as pool:
        counts = list(pool.map(check, cases))
    return {"passed": True, "readOnly": True, "queries": len(cases), "sourceRecordsVerified": sum(c[0] for c in counts), "eligibleAppearances": sum(c[1] for c in counts), "bestAppearancesIncludingTies": sum(c[2] for c in counts), "competitionBestPoints": sum(c[3] for c in counts), "sameDisciplineAndDistance": True, "exactSourceFields": True, "multiSkaterIdentityIsolation": True}


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("--url", required=True)
    cli.add_argument("--item", action="append", type=Path, required=True)
    cli.add_argument("--report", type=Path)
    args = cli.parse_args()
    origin = validate_origin(args.url)
    secret = {} if urlsplit(origin).hostname in {"localhost", "127.0.0.1", "::1"} else credentials()
    result = check_performances(origin, secret, [json.loads(p.read_text()) for p in args.item])
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result), flush=True)


if __name__ == "__main__":
    main()
