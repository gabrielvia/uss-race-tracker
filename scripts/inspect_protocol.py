"""Inventory Tempus RESULTS events, audit extractability and compare supplied evidence."""
import argparse
from collections import Counter, defaultdict
from hashlib import sha256
import json
from pathlib import Path
import re

if __package__:
    from .inspect_event import EVENT, PARSER_VERSION, parse_event_pages
    from .tempus_identity import result_name_matches, roster_name_is_consistent
    from .tempus_text import join_event_headings
else:
    from inspect_event import EVENT, PARSER_VERSION, parse_event_pages
    from tempus_identity import result_name_matches, roster_name_is_consistent
    from tempus_text import join_event_headings

VERSION = "tempus-protocol-inventory/0.3"
HEADER = re.compile(r"^(.+?)\s+Event #(\d+)$")
RACE = re.compile(r"\bRace #(\d+)\b")
RANKED = re.compile(r"^(?:\d+|[A-Z]{2,5})\s+(\d+)\s+(.+)$")
TIME_OR_STATUS = re.compile(r"(?<!\S)(?:(?:\d+:)?\d{1,2}\.\d{1,6}|PEN|DNS|DNF|DQ)(?!\S)")


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def result_like(line, names, inside_results=True):
    if RANKED.match(line):
        return inside_results or bool(TIME_OR_STATUS.search(line))
    prefixed = re.match(r"^\S+\s+(\d+)\s+(.+)$", line)
    if prefixed and any(prefixed[2].startswith(name + " ") for name in names.get(prefixed[1], ())):
        return inside_results or bool(TIME_OR_STATUS.search(line))
    match = re.match(r"^(\d+)\s+(.+)$", line)
    if not match:
        return False
    bib, rest = match.groups()
    return any(rest.startswith(name + " ") for name in names.get(bib, ())) and (inside_results or bool(TIME_OR_STATUS.search(rest)))


def inventory_protocol(pages, roster, published=None):
    numbers = [number for number, _ in pages]
    if len(numbers) != len(set(numbers)) or any(n < 1 or n > roster["page_count"] for n in numbers):
        raise ValueError("Physical page numbers must be unique and inside the source PDF")
    pages = sorted(pages)
    names = defaultdict(set)
    people = {}
    conflicting_bibs = set()
    for row in roster["observations"]:
        names[row["bib"]].update([row["name"], row["raw_name"]])
        person = (row["name"], row.get("affiliation_raw"))
        if row["bib"] in people and people[row["bib"]] != person:
            conflicting_bibs.add(row["bib"])
        people[row["bib"]] = person
    source_issues, records, race_owners = [], {}, defaultdict(set)
    if any(not roster_name_is_consistent(row) for row in roster["observations"]):
        source_issues.append({"code": "ROSTER_NAME_REVIEW", "page": None, "message": "Normalized names must match original roster names or supported, evidenced age annotations."})
    if conflicting_bibs:
        source_issues.append({"code": "ROSTER_BIB_CONFLICT", "page": None, "message": "One roster bib has conflicting normalized identities or affiliations."})
    if roster.get("issues"):
        source_issues.append({"code": "ROSTER_ISSUES", "page": None, "message": "Resolve the supplied roster's extraction issues before exporting events."})
    page_kinds = {"results": [], "classification": [], "other": [], "needs_review": []}
    if set(numbers) != set(range(1, roster["page_count"] + 1)):
        source_issues.append({"code": "PARTIAL_PAGE_SCAN", "page": None, "message": "Every physical page is required for a protocol inventory."})
    for number, text in pages:
        text, heading_evidence = join_event_headings(text)
        upper = text.upper()
        lines = text.splitlines()
        if "CLASSIFICATION" in upper:
            if "RESULTS" in upper:
                page_kinds["needs_review"].append(number)
                source_issues.append({"code": "MIXED_PAGE", "page": number, "message": "Classification and RESULTS headings share a page; table-level separation requires review."})
            else:
                page_kinds["classification"].append(number)
            continue
        if "RESULTS" not in upper:
            suspicious = any(HEADER.match(line) or RACE.search(line) or result_like(line, names, False) for line in lines)
            page_kinds["needs_review" if suspicious else "other"].append(number)
            if suspicious:
                source_issues.append({"code": "MISSING_RESULTS_HEADING", "page": number, "message": "Possible race data has no supported RESULTS heading."})
            continue
        page_kinds["results"].append(number)
        current, race_id = None, None
        for line in lines:
            heading = HEADER.match(line)
            if heading:
                label, event_number = heading[0], heading[2]
                key = (event_number, label)
                current, race_id = key, None
                if key not in records:
                    match = EVENT.match(label)
                    records[key] = {"event_number": event_number, "event_label_raw": label,
                                    "group_label": match[1] if match else None,
                                    "distance_metres": int(match[2]) if match else None,
                                    "round_raw": match[3] if match else None,
                                    "pages": set(), "source_races": [], "observed_rows": [], "issues": [], "blocks": defaultdict(list)}
                    if not match:
                        records[key]["issues"].append({"code": "UNSUPPORTED_EVENT_LABEL", "page": number, "message": "The event heading is outside the current group/distance/round parser contract."})
                records[key]["pages"].add(number)
                if label in heading_evidence:
                    records[key]["source_heading_lines"] = heading_evidence[label]
                records[key]["blocks"][number].append(line)
                continue
            if "Event #" in line:
                current, race_id = None, None
                source_issues.append({"code": "UNSUPPORTED_EVENT_HEADER", "page": number, "message": line})
                continue
            if current is not None:
                records[current]["blocks"][number].append(line)
            race = RACE.search(line)
            if race:
                race_id = race[1]
                if current is None:
                    source_issues.append({"code": "UNASSIGNED_RACE", "page": number, "message": line})
                else:
                    records[current]["source_races"].append({"race_id": race_id, "page": number, "label": line})
                    race_owners[race_id].add(current)
                continue
            if result_like(line, names):
                if current is None or race_id is None:
                    source_issues.append({"code": "UNASSIGNED_RESULT", "page": number, "message": line})
                else:
                    records[current]["observed_rows"].append((number, race_id, line))
    if not records:
        source_issues.append({"code": "NO_EVENT_TABLES", "page": None, "message": "No numbered RESULTS events were discovered."})
    events, extracted = [], {}
    for key, record in sorted(records.items(), key=lambda pair: (int(pair[0][0]), pair[0][1])):
        record["pages"] = sorted(record["pages"])
        if any(len(race_owners[r["race_id"]]) > 1 for r in record["source_races"]):
            record["issues"].append({"code": "REUSED_RACE_ID", "page": None, "message": "Source race IDs are reused across different events."})
        parsed = None
        if not record["issues"]:
            try:
                parsed = parse_event_pages([(n, "RESULTS\n" + "\n".join(record["blocks"][n])) for n in record["pages"]], roster["observations"], record["event_number"], record["event_label_raw"])
                if "source_heading_lines" in record:
                    parsed["source_heading_lines"] = record["source_heading_lines"]
                actual = Counter((r["source_page"], r["race_id"], r["row_raw"]) for r in parsed["results"])
                if actual != Counter(record["observed_rows"]):
                    record["issues"].append({"code": "UNACCOUNTED_RESULT_ROWS", "page": None, "message": "Discovered result-like rows do not exactly match extracted rows; review unsupported statuses or continuations."})
            except ValueError as error:
                record["issues"].append({"code": "EVENT_EXTRACTION", "page": None, "message": str(error)})
        identity_rows = []
        if parsed is not None:
            identity_rows = [r for r in parsed["results"] if not any(result_name_matches(r["name_raw"], o) for o in roster["observations"] if o["bib"] == r["bib"]) or people[r["bib"]][1] is not None and r["affiliation_raw"] != people[r["bib"]][1]]
            if identity_rows:
                record["issues"].append({"code": "IMPORT_IDENTITY_REVIEW", "page": identity_rows[0]["source_page"], "message": "Raw result names or affiliations differ from the normalized roster. Resolve source annotations before server import validation."})
        complete = parsed is not None and not record["issues"]
        source_blocked = bool(source_issues)
        row = {key: value for key, value in record.items() if key not in {"observed_rows", "blocks"}}
        row.update({"status": "complete_selected_event" if complete else "needs_review",
                    "observed_result_rows": len(record["observed_rows"]),
                    "parsed_result_rows": parsed["result_count"] if parsed else None, "identity_review_rows": len(identity_rows),
                    "result_count": parsed["result_count"] if complete else None,
                    "heat_count": parsed["heat_count"] if complete else None,
                    "export_eligible": complete and not source_blocked, "publication": "not_checked"})
        events.append(row)
        if row["export_eligible"]:
            extracted[key] = {"parser_version": PARSER_VERSION, "status": "complete_selected_event",
                              "source_id": roster["source_id"], "source_url": roster["source_url"], "sha256": roster["sha256"],
                              "pages": record["pages"], **parsed}
    coverage = {"basis": "not_checked", "published_events": None, "not_published_events": None, "unknown_published_events": []}
    if published is not None:
        if not isinstance(published, dict):
            raise ValueError("Publication evidence must be a JSON object")
        evidence = published.get("evidence", published)
        if not isinstance(evidence, dict) or "roster" not in evidence or any(evidence["roster"].get(k) != roster[k] for k in ["sha256", "source_id", "source_url"]):
            raise ValueError("Supplied publication evidence belongs to another source revision")
        selected = evidence.get("events") or ([evidence["race"]] if "race" in evidence else [])
        if not selected:
            raise ValueError("Supplied publication evidence has no selected events")
        selected_keys = set()
        for selected_event in selected:
            if any(selected_event.get(k) != roster[k] for k in ["sha256", "source_id", "source_url"]):
                raise ValueError("A supplied publication event belongs to another source revision")
            key = (selected_event["event_number"], selected_event["event_label_raw"])
            if key in selected_keys:
                raise ValueError("Duplicate event in supplied publication evidence")
            selected_keys.add(key)
            if key not in records:
                coverage["unknown_published_events"].append({"event_number": key[0], "event_label_raw": key[1]})
        for event in events:
            key = (event["event_number"], event["event_label_raw"])
            if key not in selected_keys:
                event["publication"] = "not_published"
            else:
                selected_event = next(e for e in selected if (e["event_number"], e["event_label_raw"]) == key)
                parsed_event = extracted.get(key)
                matches = parsed_event is not None and all(canonical(selected_event.get(k)) == canonical(parsed_event[k]) for k in ["results", "heats", "result_count", "heat_count"])
                event["publication"] = "published_verified" if matches else "published_needs_review"
        coverage.update({"basis": "supplied_evidence_snapshot", "published_events": len(selected),
                         "not_published_events": sum(e["publication"] == "not_published" for e in events)})
    report = {"inventory_version": VERSION, "source_id": roster["source_id"], "source_url": roster["source_url"],
              "sha256": roster["sha256"], "pdf_page_count": roster["page_count"], "scanned_page_count": len(pages),
              "scope": "Numbered Tempus RESULTS events; classifications and unsupported layouts require separate review.",
              "complete_competition": False, "source_issues": source_issues, "page_kinds": page_kinds,
              "summary": {"discovered_events": len(events), "complete_selected_events": sum(e["status"] == "complete_selected_event" for e in events),
                          "needs_review_events": sum(e["status"] == "needs_review" for e in events), "export_eligible_events": len(extracted)},
              "coverage": coverage, "events": events}
    return report, extracted


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("--file", type=Path, required=True)
    cli.add_argument("--roster", type=Path, required=True)
    cli.add_argument("--published-evidence", type=Path, help="Saved extraction evidence snapshot, not a live database query.")
    cli.add_argument("--output", type=Path, required=True)
    cli.add_argument("--events-output", type=Path, help="Export eligible complete-event files in an immutable report-specific subdirectory.")
    args = cli.parse_args()
    roster = json.loads(args.roster.read_text())
    with args.file.open("rb") as source:
        digest = sha256()
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    if digest.hexdigest() != roster["sha256"]:
        cli.error("The PDF does not match the roster's source hash")
    import pdfplumber
    pages = []
    with pdfplumber.open(args.file) as pdf:
        if len(pdf.pages) != roster["page_count"]:
            cli.error("The PDF page count does not match the roster")
        for index, page in enumerate(pdf.pages, 1):
            pages.append((index, page.extract_text() or ""))
            page.close()
            if index % 25 == 0:
                print(f"Read {index}/{len(pdf.pages)} physical pages", flush=True)
    try:
        published = json.loads(args.published_evidence.read_text()) if args.published_evidence else None
        report, extracted = inventory_protocol(pages, roster, published)
    except ValueError as error:
        cli.error(str(error))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    result = {"inventoried": True, **report["summary"], "source_issues": len(report["source_issues"]), "published": False}
    if args.events_output:
        folder = args.events_output / sha256(canonical(report).encode()).hexdigest()[:20]
        folder.mkdir(parents=True, exist_ok=True)
        for event in extracted.values():
            identity = sha256(event["event_label_raw"].encode()).hexdigest()[:20]
            (folder / f"event-{event['event_number']}-{identity}.json").write_text(json.dumps(event, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        result["event_directory"] = str(folder)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
