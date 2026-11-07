"""Build directory/audit coverage without inferring live publication status."""
import argparse
from collections import Counter
import json
from pathlib import Path


def coverage(inventory, reviews, reports):
    sources = {e["source_id"]: e for e in inventory["entries"]}
    checked, seen = [], set()
    for review, report in zip(reviews, reports, strict=True):
        source_id = report["source_id"]
        source = sources.get(source_id)
        if source is None or source["entry_url"] != report["source_url"] or source_id in seen:
            raise ValueError("Audit must identify one unique current directory source URL.")
        seen.add(source_id)
        if review["sha256"] != report["sha256"]:
            raise ValueError("Audit review and report hashes must match.")
        summary = report["summary"]
        complete = (not report["source_issues"] and summary["discovered_events"] > 0
                    and summary["needs_review_events"] == 0
                    and summary["export_eligible_events"] == summary["discovered_events"]
                    and report["scanned_page_count"] == report["pdf_page_count"])
        if review["status"] not in {"audited", "needs-review"} or review["status"] == "audited" and not complete:
            raise ValueError("A full RESULTS audit requires an intact, complete source report.")
        checked.append({"sourceId": source_id, "url": report["source_url"], "sha256": report["sha256"],
                        "season": source["season"], "title": source["title"], "status": review["status"],
                        "checkedAt": review["checked_at"], "pages": report["pdf_page_count"],
                        "discoveredEvents": summary["discovered_events"], "parsedEvents": summary["complete_selected_events"],
                        "needsReviewEvents": summary["needs_review_events"], "sourceIssues": report["source_issues"]})
    audited = {r["sourceId"] for r in checked if r["status"] == "audited"}
    by_season = []
    for season in inventory["seasons"]:
        ids = {e["source_id"] for e in inventory["entries"] if e["season"] == season}
        by_season.append({"season": season, "directoryEntries": sum(e["season"] == season for e in inventory["entries"]),
                          "directorySources": len(ids), "auditedSources": len(ids & audited), "pendingSources": len(ids - audited)})
    return {"directory": {"url": inventory["directory_url"], "checkedAt": inventory["retrieved_at"],
                           "sha256": inventory["directory_sha256"], "entries": len(inventory["entries"]),
                           "sources": len(sources), "formats": dict(Counter(e["format_hint"] for e in sources.values()))},
            "audit": {"scope": "Reviewed individual result protocols; classifications and supplements are separate evidence. Lap-count events retain their original units.",
                      "auditedSources": len(audited), "partlyParsedSources": sum(r["status"] != "audited" for r in checked),
                      "uninspectedSources": len(sources) - len(checked), "pendingSources": len(sources) - len(audited),
                      "lastCheckedAt": max((r["checkedAt"] for r in checked), default=None)},
            "seasons": by_season, "reviews": checked}


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("--inventory", type=Path, default=Path("data/sources/inventory.json"))
    cli.add_argument("--reviews", type=Path, default=Path("data/sources/reviews.json"))
    cli.add_argument("--output", type=Path, default=Path("web/lib/source-coverage.json"))
    args = cli.parse_args()
    reviews = json.loads(args.reviews.read_text())
    result = coverage(json.loads(args.inventory.read_text()), reviews,
                      [json.loads(Path(r["report"]).read_text()) for r in reviews])
    args.output.write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result["audit"]))


if __name__ == "__main__":
    main()
