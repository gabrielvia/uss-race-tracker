"""Read-only verification of structured result filters and source-backed history."""
import argparse
import json
from pathlib import Path
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, build_opener
from .check_site import SameOriginRedirectHandler, credentials, validate_origin
from .competition_dimensions import dimensions


def check_browsing(origin, secret, items):
    opener = build_opener(SameOriginRedirectHandler())

    def get(path):
        headers = {"OAI-Sites-Authorization": "Bearer " + secret["service_token"]} if secret.get("service_token") else {}
        with opener.open(Request(origin + path, headers=headers), timeout=60) as response:
            return json.load(response)

    reports = []
    for item in items:
        cid = item["competition"]["id"]
        expected = dimensions(item)
        row_dimensions = {r["id"]: r for r in expected["results"]}
        events = {e["id"]: e for e in expected["events"]}
        original = {r["id"]: r for r in item["results"]}
        full = get("/api/competitions/" + cid)
        evidence = get("/api/sources/" + full["competition"]["source_id"])
        assert evidence["dimensions"] == expected
        for row in full["results"]:
            d = row_dimensions[row["id"]]
            assert (row["entry_id"], row["gender"], row["division_key"]) == (d["entryId"], d["gender"], d["division"])
        filters = [{}, {"gender": "Women", "division": "Junior E", "distance": "500", "round": "Quarter-Finals"}, {"gender": "Women", "division": "No such division"}]
        filters += [{"division": v} for v in sorted({e["division"] for e in expected["entries"]})]
        filters += [{"gender": v} for v in ["Women", "Men", "Mixed", "Unknown"]]
        filters += [{"event": e["id"]} for e in expected["events"][:2]]

        def matches(rid, selected):
            raw, d = original[rid], row_dimensions[rid]
            values = {"gender": d["gender"], "division": d["division"], "distance": str(raw["distance"]), "round": raw["round"], "event": raw["eventKey"]}
            return all((events[raw["eventKey"]]["gender"] == "Mixed" if key == "gender" and value == "Mixed" else values[key] == value) for key, value in selected.items())

        for selected in filters:
            detail = get("/api/competitions/" + cid + "?" + urlencode(selected))
            ids = {rid for rid in original if matches(rid, selected)}
            assert {r["id"] for r in detail["results"]} == ids
            assert len(detail["results"]) == detail["matching"]["results"] == len(ids)
            assert detail["matching"]["events"] == len({original[rid]["eventKey"] for rid in ids})
            for key in ["gender", "division", "distance", "round"]:
                others = {k: v for k, v in selected.items() if k != key}
                actual = {str(o["value"]): o["count"] for o in detail["options"][key]}
                values = {row_dimensions[rid][key] if key in {"gender", "division"} else str(original[rid][key]) for rid in original if matches(rid, others)}
                if key == "gender" and any(matches(rid, others) and events[original[rid]["eventKey"]]["gender"] == "Mixed" for rid in original):
                    values.add("Mixed")
                assert actual == {value: sum(matches(rid, {**others, key: value}) for rid in original) for value in values}
        for bib in (["185", "54"] if cid.startswith("st-") else ["370", "368"]):
            pid = cid + ":" + bib
            path = "/api/participants/" + pid + "/records"
            for selection in [{}, {"discipline": item["competition"]["discipline"]}, {"season": item["competition"]["season"]}]:
                waiting = get(path + "?" + urlencode(selection))
                assert not waiting["selectionRequired"] and waiting["total"] == len([r for r in item["results"] if r["participantId"] == pid])
            history = get(path + "?" + urlencode({"discipline": item["competition"]["discipline"], "season": item["competition"]["season"]}))
            assert not history["selectionRequired"]
            ids = {r["id"] for r in item["results"] if r["participantId"] == pid}
            assert history["total"] == len(ids) and {r["id"] for r in history["results"]} == ids
            if bib == "370":
                assert {r["entry_division"] for r in history["results"]} == {"Master Women", "Junior A-B-Senior Women"}
        reports.append({"competition": cid, "queries": len(filters), "results": len(original), "facetsVerified": True, "historyVerified": True})
    same_name = get("/api/skaters?" + urlencode({"q": "Sara Cushman"}))
    assert same_name["total"] == 2, "Same-name competition-local identities must remain separate."
    first, second = get("/api/skaters?page=1"), get("/api/skaters?page=2")
    assert first["total"] == second["total"] == 289
    assert len(first["skaters"]) == len(second["skaters"]) == 25
    assert not ({r["id"] for r in first["skaters"]} & {r["id"] for r in second["skaters"]})
    return {"passed": True, "readOnly": True, "protocols": reports, "sameNameIdentitiesSeparate": True, "athletePaginationVerified": True, "historySelectionRequired": False}


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("--url", required=True)
    cli.add_argument("--item", action="append", type=Path, required=True)
    cli.add_argument("--report", type=Path)
    args = cli.parse_args()
    origin = validate_origin(args.url)
    secret = {} if urlsplit(origin).hostname in {"localhost", "127.0.0.1", "::1"} else credentials()
    result = check_browsing(origin, secret, [json.loads(p.read_text()) for p in args.item])
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result), flush=True)


if __name__ == "__main__":
    main()
