"""Prepare one bounded, fully scanned Tempus RESULTS candidate item and raw classifications."""
import argparse
from collections import Counter
from hashlib import sha256
import json
from pathlib import Path
import re

if __package__:
    from .inspect_protocol import inventory_protocol
    from .prepare_web_sample import prepare_item
else:
    from inspect_protocol import inventory_protocol
    from prepare_web_sample import prepare_item


def assemble_protocol(pages, roster, metadata, published=None):
    report, extracted = inventory_protocol(pages, roster, published)
    roster_pages=[n for n,text in pages if "SKATER LIST" in text.upper()]
    actual,expected=Counter(),Counter()
    if sorted(roster.get("roster_pages",[]))!=sorted(roster_pages) or not roster_pages:
        report["source_issues"].append({"code":"ROSTER_PAGE_COVERAGE","page":None,"message":"The supplied roster must account for every SKATER LIST page in the fully scanned source."})
    for number,text in pages:
        if number not in roster_pages:continue
        lines=text.splitlines()
        header=next((i for i,line in enumerate(lines) if {"#","Name","Gender","Division","Club"}<=set(line.split())),None)
        if header is None:
            report["source_issues"].append({"code":"ROSTER_HEADER","page":number,"message":"An unsupported roster header requires review."});continue
        status="Status" in lines[header].split()
        for line in lines[header+1:]:
            if re.match(r"^\d+\s+",line):actual[(number," ".join(line.split()))]+=1
        for o in roster["observations"]:
            if o["page"]!=number:continue
            fields=[o["bib"],o["raw_name"]]+([o.get("age_status_raw")] if status else [])+[o.get("gender"),o["division_raw"],o["affiliation_raw"]]
            expected[(number," ".join(" ".join(v for v in fields if v).split()))]+=1
    if actual!=expected:
        report["source_issues"].append({"code":"ROSTER_SOURCE_ROWS","page":None,"message":"Every original roster row must match one supplied observation, including participants without race results."})
    if report["source_issues"] or report["summary"]["needs_review_events"]:
        return report, None
    if len(extracted)>250 or sum(e["result_count"] for e in extracted.values())>5000:
        report["source_issues"].append({"code":"IMPORT_BOUND","page":None,"message":"This source exceeds the supported 250-event/5,000-result publication unit; review the saved inventory rather than truncating it."})
        return report, None
    classifications = []
    for number, text in pages:
        upper = text.upper()
        if "CLASSIFICATION" not in upper or "RESULTS" in upper:
            continue
        lines, rows = text.splitlines(), []
        heading = next((i for i, line in enumerate(lines) if "CLASSIFICATION" in line.upper()), 0)
        for line in lines:
            match = re.fullmatch(r"(\d+|PEN|DNS|DNF|DQ|FNT|YC)\s+(\d+)\s+(.+)", line)
            if match and any(o["bib"] == match[2] and any(match[3].startswith(name + " ") for name in {o["name"], o["raw_name"]}) for o in roster["observations"]):
                rows.append({"rank": int(match[1]) if match[1].isdigit() else None, "bib": match[2], "row_raw": line})
        classifications.append({"page": number, "kind": "overall" if "OVERALL CLASSIFICATION" in upper else "distance" if "DISTANCE CLASSIFICATION" in upper else "other",
                                "label": " / ".join(lines[max(0, heading - 1):heading + 1]), "text_raw": text, "rows": rows})
    item = prepare_item(metadata, roster, list(extracted.values()))
    item["protocol"] = {"parser_version": "tempus-protocol-batch/0.1", "sha256": roster["sha256"],
                        "scanned_pages": sorted(n for n, _ in pages), "event_labels": [e["event_label_raw"] for e in extracted.values()],
                        "roster_verification": {"pages": sorted(roster_pages), "observation_count": len(roster["observations"]), "exact_rows": True}, "classification_pages": report["page_kinds"]["classification"], "complete_results": True, "result_count": len(item["results"]), "classifications": classifications, "issues": []}
    return report, item


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    for name in ["file", "roster", "metadata", "output", "report"]:
        cli.add_argument("--" + name, type=Path, required=True)
    cli.add_argument("--published-evidence", type=Path)
    args = cli.parse_args()
    roster, metadata = json.loads(args.roster.read_text()), json.loads(args.metadata.read_text())
    if sha256(args.file.read_bytes()).hexdigest() != roster["sha256"]:
        cli.error("The PDF does not match the roster's exact source revision")
    import pdfplumber
    pages = []
    with pdfplumber.open(args.file) as pdf:
        if len(pdf.pages) != roster["page_count"]:
            cli.error("The PDF page count does not match the roster")
        for number, page in enumerate(pdf.pages, 1):
            pages.append((number, page.extract_text() or "")); page.close()
    report, item = assemble_protocol(pages, roster, metadata, json.loads(args.published_evidence.read_text()) if args.published_evidence else None)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    if item is None:
        cli.error("Resolve all source/event extraction issues in the saved report before assembling this protocol")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(item, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"prepared": True, "events": len(item["evidence"]["events"]), "results": len(item["results"]), "classification_pages": len(item["protocol"]["classifications"]), "published": False}))


if __name__ == "__main__":
    main()
