"""Measure bounded read-only queries against the currently published real corpus."""
import argparse
import json
import math
from pathlib import Path
from statistics import median
from time import perf_counter
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, build_opener
from .check_site import SameOriginRedirectHandler, credentials, validate_origin


def benchmark(origin, secret, items, runs=5):
    headers = {"OAI-Sites-Authorization": "Bearer " + secret["service_token"]} if secret.get("service_token") else {}
    opener = build_opener(SameOriginRedirectHandler())
    def get(path):
        with opener.open(Request(origin + path, headers=headers), timeout=60) as response:
            raw = response.read()
            return json.loads(raw), len(raw)
    coverage, _ = get("/api/coverage")
    assert coverage["published"]["competitionCount"] == len(items)
    assert coverage["published"]["resultCount"] == sum(len(i["results"]) for i in items)
    paths = {"coverage": "/api/coverage", "scopes": "/api/competitions/scopes", "skaterSearch": "/api/skaters?q=Lin&page=1"}
    for item in items:
        c = item["competition"]
        distance = item["results"][0]["distance"]
        ids = list(dict.fromkeys(r["participantId"] for r in item["results"] if r["distance"] == distance))[:4]
        paths[c["id"] + ":directory"] = "/api/competitions?" + urlencode({"discipline": c["discipline"], "season": c["season"], "page": 1})
        paths[c["id"] + ":allResults"] = "/api/competitions/" + c["id"]
        paths[c["id"] + ":profile"] = "/api/participants/" + ids[0] + "/profile"
        paths[c["id"] + ":personalBests"] = "/api/participants/" + ids[0] + "/personal-bests"
        paths[c["id"] + ":fourSkaterChart"] = "/api/performances?" + urlencode({"participant": ids, "discipline": c["discipline"], "distance": distance}, doseq=True)
    reports = []
    for name, path in paths.items():
        get(path)  # Separate the warm-up from reported repeat measurements.
        elapsed, sizes = [], []
        for _ in range(runs):
            start = perf_counter()
            _, size = get(path)
            elapsed.append((perf_counter() - start) * 1000)
            sizes.append(size)
        reports.append({"query": name, "runs": runs, "medianMs": round(median(elapsed), 2),
                        "p95Ms": round(sorted(elapsed)[math.ceil(.95 * len(elapsed)) - 1], 2), "maxBytes": max(sizes)})
    return {"readOnly": True, "basis": "Observed warm HTTP round trips; includes network and serialization, not a service-level guarantee.",
            "competitions": len(items), "results": sum(len(i["results"]) for i in items), "queries": reports}


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("--url", required=True)
    cli.add_argument("--item", type=Path, action="append", required=True)
    cli.add_argument("--runs", type=int, default=5, choices=range(1, 21))
    cli.add_argument("--report", type=Path, required=True)
    args = cli.parse_args()
    origin = validate_origin(args.url)
    secret = {} if urlsplit(origin).hostname in {"127.0.0.1", "localhost", "::1"} else credentials()
    result = benchmark(origin, secret, [json.loads(p.read_text()) for p in args.item], args.runs)
    args.report.write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result))


if __name__ == "__main__":
    main()
