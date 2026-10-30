"""Extract one explicitly selected race for review, using a sampled local roster."""

import argparse
from decimal import Decimal
from hashlib import sha256
import json
from pathlib import Path
import re


def parse_race(text, roster, race_id):
    if "RESULTS" not in text or "CLASSIFICATION" in text:
        raise ValueError("Expected a race results page, not a classification table")
    names = {}
    for entry in roster:
        names.setdefault(entry["bib"], set()).add(entry["raw_name"])
        names[entry["bib"]].add(entry["name"])
    event, race, rows = None, None, []
    for line in text.splitlines():
        if re.search(r"Event #\d+", line):
            event = line
        match = re.search(r"Race #(\d+)\b", line)
        if match:
            race = match[1]
            if race == race_id:
                race_label = line
            continue
        if race != race_id:
            continue
        row = re.match(r"^(\d+)\s+(\d+)\s+(.+)$", line)
        if not row:
            continue
        rank, bib, remainder = row.groups()
        candidates = sorted((name for name in names.get(bib, ()) if remainder.startswith(name + " ")), key=len, reverse=True)
        if not candidates:
            raise ValueError(f"Cannot match bib {bib} to this competition's roster")
        name = candidates[0]
        finish = re.search(r"\s(\d+:\d{2}\.\d{1,6})(?:\s+(.*))?$", remainder)
        if not finish:
            raise ValueError(f"Unsupported finish for bib {bib}; review the original page")
        minutes, seconds = finish[1].split(":")
        if Decimal(seconds) >= 60:
            raise ValueError(f"Invalid seconds for bib {bib}")
        event_match = re.search(r"\s(\d+)\s+(Quarter-Finals|Semi-Finals|Finals) Event #(\d+)$", event or "")
        if not event_match:
            raise ValueError("Unsupported event label; cannot safely determine distance and round")
        rows.append({
            "rank": int(rank), "bib": bib, "name_raw": name,
            "affiliation_raw": remainder[len(name):finish.start()].strip(),
            "time_raw": finish[1], "time_microseconds": int((int(minutes) * 60 + Decimal(seconds)) * 1_000_000),
            "timing_decimal_places": len(seconds.split(".")[1]),
            "qualification_raw": finish[2] or None, "event_label_raw": event,
            "event_number": event_match[3], "distance_metres": int(event_match[1]),
            "round_raw": event_match[2], "race_id": race, "race_label_raw": race_label,
        })
    if not rows:
        raise ValueError("The requested race was not found or has no supported result rows")
    return rows


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("--file", type=Path, required=True)
    cli.add_argument("--roster", type=Path, required=True)
    cli.add_argument("--page", type=int, required=True, help="Physical PDF page, starting at 1.")
    cli.add_argument("--race-id", required=True)
    cli.add_argument("--output", type=Path, required=True)
    args = cli.parse_args()
    roster = json.loads(args.roster.read_text())
    digest = sha256(args.file.read_bytes()).hexdigest()
    if digest != roster["sha256"]:
        cli.error("The PDF does not match the roster's source hash")
    import pdfplumber
    with pdfplumber.open(args.file) as pdf:
        if not 1 <= args.page <= len(pdf.pages):
            cli.error("--page is outside the PDF")
        rows = parse_race(pdf.pages[args.page - 1].extract_text() or "", roster["observations"], args.race_id)
    result = {
        "parser_version": "tempus-selected-race/0.1", "status": "sample_requires_review",
        "source_id": roster["source_id"], "source_url": roster["source_url"], "sha256": digest,
        "page": args.page, "race_id": args.race_id, "result_count": len(rows), "results": rows,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Extracted {len(rows)} results for race {args.race_id} on PDF page {args.page}.")


if __name__ == "__main__":
    main()
