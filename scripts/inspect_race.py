"""Extract one explicitly selected race for review, using a sampled local roster."""

import argparse
from decimal import Decimal
from hashlib import sha256
import json
from pathlib import Path
import re

if __package__:
    from .tempus_text import join_event_headings
else:
    from tempus_text import join_event_headings


def parse_race(text, roster, race_id):
    text, heading_evidence = join_event_headings(text)
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
        row = re.match(r"^(\d+|PEN|DNS|DNF|DQ|FNT|YC)\s+(\d+)\s+(.+)$", line)
        prefix_status = None
        if row:
            place, bib, remainder = row.groups()
            rank = int(place) if place.isdigit() else None
            prefix_status = None if place.isdigit() else place
        else:
            # Tempus short-track protocols leave place blank for status rows.
            row = re.match(r"^(\d+)\s+(.+)$", line)
            if not row:
                continue
            bib, remainder = row.groups()
            if bib not in names:
                if re.search(r"\b(PEN|DNS|DNF|DQ|FNT|YC)\b", remainder):
                    raise ValueError(f"Cannot match bib {bib} to this competition's roster")
                continue
            rank = None
        candidates = sorted((name for name in names.get(bib, ()) if remainder.startswith(name + " ")), key=len, reverse=True)
        if not candidates:
            raise ValueError(f"Cannot match bib {bib} to this competition's roster")
        name = candidates[0]
        tail = remainder[len(name):].strip()
        finish = re.search(r"(?<!\S)((?:\d+:)?\d{1,2}\.\d{1,6})(?!\S)", tail)
        statuses = list(re.finditer(r"(?<!\S)(PEN|DNS|DNF|DQ|FNT|YC)(?!\S)", tail))
        codes = {m[1] for m in statuses}
        if prefix_status:
            codes.add(prefix_status)
        if len(codes) > 1:
            raise ValueError(f"Conflicting result statuses for bib {bib}")
        status = next(iter(codes), None)
        missing_finish = not finish and not status and rank is not None and any(e.get("affiliation_raw") == tail for e in roster if e["bib"] == bib)
        if (not finish and not status and not missing_finish) or rank is None and not status:
            raise ValueError(f"Unsupported finish for bib {bib}; review the original page")
        raw_time, microseconds, decimal_places = None, None, None
        if finish:
            raw_time = finish[1]
            minutes, seconds = raw_time.split(":") if ":" in raw_time else ("0", raw_time)
            if Decimal(seconds) >= 60:
                raise ValueError(f"Invalid seconds for bib {bib}")
            microseconds = int((int(minutes) * 60 + Decimal(seconds)) * 1_000_000)
            decimal_places = len(seconds.split(".")[1])
        markers = ([finish] if finish else []) + statuses
        boundary = min(m.start() for m in markers) if markers else len(tail)
        affiliation = tail[:boundary].strip()
        suffix = tail[boundary:]
        suffix = re.sub(r"(?<!\S)(?:PEN|DNS|DNF|DQ|FNT|YC|(?:\d+:)?\d{1,2}\.\d{1,6})(?!\S)", "", suffix).strip()
        event_match = re.search(r"\s(\d+)\s+(Quarter-Finals|Semi-Finals|Finals) Event #(\d+)$", event or "")
        if not event_match:
            raise ValueError("Unsupported event label; cannot safely determine distance and round")
        rows.append({
            "rank": rank, "status_raw": status, "row_raw": line, "bib": bib, "name_raw": name,
            "affiliation_raw": affiliation,
            "time_raw": raw_time, "time_microseconds": microseconds,
            "timing_decimal_places": decimal_places,
            "qualification_raw": suffix or None, "event_label_raw": event,
            "event_number": event_match[3], "distance_metres": int(event_match[1]),
            "round_raw": event_match[2], "race_id": race, "race_label_raw": race_label,
        })
        if missing_finish:
            rows[-1]["finish_note"] = "Time not recorded in source."
        if event in heading_evidence:
            rows[-1]["source_heading_lines"] = heading_evidence[event]
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
        "parser_version": "tempus-selected-race/0.2", "status": "sample_requires_review",
        "source_id": roster["source_id"], "source_url": roster["source_url"], "sha256": digest,
        "page": args.page, "race_id": args.race_id, "result_count": len(rows), "results": rows,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Extracted {len(rows)} results for race {args.race_id} on PDF page {args.page}.")


if __name__ == "__main__":
    main()
