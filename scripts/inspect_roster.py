"""Extract review-only roster observations from supported Tempus PDF layouts.

This is a sampling tool, not a production importer or an identity resolver.
"""

import argparse
from collections import defaultdict
from hashlib import sha256
import json
from pathlib import Path
import re

if __package__:
    from .tempus_identity import REVIEWED_ROSTER_FIELDS, split_age_annotation
    from .tempus_text import REVIEWED_LAYOUTS, reviewed_empty_roster
else:
    from tempus_identity import REVIEWED_ROSTER_FIELDS, split_age_annotation
    from tempus_text import REVIEWED_LAYOUTS, reviewed_empty_roster

PARSER_VERSION = "tempus-roster-sample/0.1"


def group_lines(words, tolerance=3):
    lines = []
    for word in sorted(words, key=lambda word: (word["top"], word["x0"])):
        if not lines or abs(word["top"] - lines[-1][0]["top"]) > tolerance:
            lines.append([])
        lines[-1].append(word)
    return [sorted(line, key=lambda word: word["x0"]) for line in lines]


def parse_roster_words(words, page_number, status_column="age_status_raw", allow_mixed=False):
    lines = group_lines(words)
    header = None
    for line in lines:
        tokens = {word["text"] for word in line}
        if {"#", "Name", "Gender", "Division", "Club"} <= tokens:
            header = line
            break
    if header is None:
        return [], [{"page": page_number, "reason": "unsupported_roster_header"}]
    columns = [(word["x0"] - 2, {"#": "bib", "Name": "raw_name", "Status": status_column, "Gender": "gender", "Division": "division_raw", "Club": "affiliation_raw"}[word["text"]]) for word in header if word["text"] in {"#", "Name", "Status", "Gender", "Division", "Club"}]
    # Bib values are right-aligned and may begin left of the centered # header.
    columns[0] = (float("-inf"), "bib")
    observations, issues = [], []
    genders = {"Male", "Female", "Mixed"} if allow_mixed else {"Male", "Female"}
    for line in lines:
        if line[0]["top"] <= header[0]["top"] or not re.fullmatch(r"\d+", line[0]["text"]):
            continue
        fields = defaultdict(list)
        for word in line:
            eligible = [name for x, name in columns if word["x0"] >= x]
            if eligible:
                fields[eligible[-1]].append(word["text"])
        row = {name: " ".join(fields[name]) for _, name in columns}
        if not row["bib"].isdigit() or not row["raw_name"] or row["gender"] not in genders or not row["affiliation_raw"]:
            issues.append({"page": page_number, "reason": "unparsed_roster_row", "raw": " ".join(word["text"] for word in line)})
            continue
        # Parenthesized age labels occur inside the name column in the long-track sample.
        if status_column == "school_raw":
            row["name"] = row["raw_name"]
            row["school_raw"] = row.get("school_raw") or None
            row["age_status_raw"] = None
        else:
            row["name"], annotation = split_age_annotation(row["raw_name"])
            row["age_status_raw"] = row.get("age_status_raw") or annotation
        row["club_name"] = None if row["affiliation_raw"].casefold() == "direct" else row["affiliation_raw"]
        row["age_evidence_type"] = "explicit_category" if row["age_status_raw"] else "unresolved_division"
        row["page"] = page_number
        row["identity_status"] = "competition_local_only"
        observations.append(row)
    return observations, issues


def classification_roster(text, page):
    """Read entries from a reviewed overall classification with bib and status columns."""
    lines = text.splitlines()
    if len(lines) < 3 or lines[2] != "OVERALL CLASSIFICATION" or "# Name Status Affiliation Points CDR BDR" not in lines:
        return [], [{"page": page, "reason": "unsupported_classification_roster"}]
    observations, issues = [], []
    for line in lines:
        if not re.match(r"^\d+ \d+ ", line):
            continue
        fields = re.fullmatch(r"\d+ (\d+) (.+?) (JR(?: [A-G])?|SR|\d+\+) (.+?) [\d,]+ \d+ \d+ \d+:\d{2}\.\d{3}", line)
        if not fields:
            issues.append({"page": page, "reason": "unparsed_classification_roster_row", "raw": line})
            continue
        bib, name, status, club = fields.groups()
        observations.append({"bib": bib, "name": name, "raw_name": name, "age_status_raw": status,
                             "division_raw": lines[1], "affiliation_raw": club, "club_name": club,
                             "age_evidence_type": "explicit_category", "page": page, "row_raw": line,
                             "identity_status": "competition_local_only"})
    return observations, issues


def inspect_pdf(path, source_id, source_url, max_pages=10):
    import pdfplumber

    observations, issues, roster_pages = [], [], []
    digest = sha256(path.read_bytes()).hexdigest()
    roster_fields = REVIEWED_ROSTER_FIELDS.get(digest, {})
    status_column = "school_raw" if roster_fields.get("statusColumn") == "school" else "age_status_raw"
    classification_pages = REVIEWED_LAYOUTS.get(digest, {}).get("classificationRosterPages", [])
    with pdfplumber.open(path) as pdf:
        for page_number, page in enumerate(pdf.pages[:max_pages], 1):
            text = page.extract_text() or ""
            if page_number in classification_pages:
                rows, row_issues = classification_roster(text, page_number)
            elif "SKATER LIST" in text:
                if reviewed_empty_roster(text, digest, page_number):
                    roster_pages.append(page_number)
                    continue
                rows, row_issues = parse_roster_words(page.extract_words(), page_number, status_column, roster_fields.get("allowMixedGender", False))
            else:
                continue
            roster_pages.append(page_number)
            observations.extend(rows)
            issues.extend(row_issues)
        page_count = len(pdf.pages)
    if not observations:
        issues.append({"reason": "no_roster_observations_found"})
    by_bib = defaultdict(list)
    for row in observations:
        by_bib[row["bib"]].append(row)
    repeated = {bib: [{"name": row["name"], "division": row["division_raw"], "page": row["page"]} for row in rows] for bib, rows in by_bib.items() if len(rows) > 1}
    return {
        "parser_version": PARSER_VERSION, "source_id": source_id, "source_url": source_url,
        "sha256": digest, "page_count": page_count,
        "sampled_page_count": min(page_count, max_pages), "roster_pages": roster_pages,
        "observation_count": len(observations), "distinct_bib_count": len(by_bib),
        "repeated_bibs": repeated, "issues": issues,
        "status": "sample_requires_review", "observations": observations,
    }


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("--file", type=Path, required=True)
    cli.add_argument("--source-id", required=True)
    cli.add_argument("--inventory", type=Path, default=Path("data/sources/inventory.json"))
    cli.add_argument("--max-pages", type=int, default=10)
    cli.add_argument("--output", type=Path, required=True)
    args = cli.parse_args()
    if args.max_pages < 1:
        cli.error("--max-pages must be positive")
    inventory = json.loads(args.inventory.read_text())
    source = next((entry for entry in inventory["entries"] if entry["source_id"] == args.source_id), None)
    if source is None:
        cli.error("Source ID was not found in the inventory")
    result = inspect_pdf(args.file, args.source_id, source["entry_url"], args.max_pages)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    summary = {key: result[key] for key in ("source_id", "page_count", "observation_count", "distinct_bib_count", "repeated_bibs")}
    summary["issue_count"] = len(result["issues"])
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
