"""Extract every heat of one explicitly identified group/distance/round."""
import argparse
from hashlib import sha256
import json
from pathlib import Path
import re

from scripts.inspect_race import parse_race

EVENT = re.compile(r"^(.+?)\s+(\d+)\s+(Quarter-Finals|Semi-Finals|Finals) Event #(\d+)$")
RESULT_ROW = re.compile(r"^(?:\d+|PEN|DNS|DNF|DQ)\s+\d+\s+\S")


def parse_event_pages(pages, roster, event_number):
    rows, labels, races, expected_totals = [], set(), {}, set()
    for page_number, text in pages:
        if "CLASSIFICATION" in text:
            continue
        if "RESULTS" not in text:
            if any(RESULT_ROW.match(line) for line in text.splitlines()):
                raise ValueError(f"Unsupported result continuation on page {page_number}: no RESULTS heading")
            continue
        current_event = None
        current_race = None
        for line in text.splitlines():
            event_match = EVENT.match(line)
            if event_match:
                current_event = event_match
                current_race = None
                continue
            race_match = re.search(r"Race #(\d+)\b", line)
            if race_match:
                if current_event is None:
                    raise ValueError(f"Unsupported result continuation on page {page_number}: no event heading")
                current_race = race_match[1]
            elif RESULT_ROW.match(line) and (current_event is None or current_race is None):
                raise ValueError(f"Unsupported result continuation on page {page_number}: no event or race heading")
            if not race_match or not current_event or current_event[4] != str(event_number):
                continue
            labels.add(current_event[0])
            race_id = race_match[1]
            if race_id in races:
                raise ValueError("A race appears on multiple pages; continuation parsing requires review")
            heat = re.search(r"Heat (\d+) of (\d+)", line)
            heat_number, heat_total = (int(heat[1]), int(heat[2])) if heat else (None, None)
            if heat:
                expected_totals.add(heat_total)
            race_rows = parse_race(text, roster, race_id)
            if any(r["event_label_raw"] != current_event[0] for r in race_rows):
                raise ValueError("Race rows crossed an event boundary")
            races[race_id] = {"race_id": race_id, "label": line, "heat_number": heat_number, "heat_total": heat_total, "result_count": len(race_rows)}
            for row in race_rows:
                rows.append({**row, "source_page": page_number, "group_label": current_event[1],
                             "heat_number": heat_number, "heat_total": heat_total})
    if not rows:
        raise ValueError("No results found for the requested event")
    if len(labels) != 1:
        raise ValueError("The event number maps to different groups or rounds; review before combining")
    if expected_totals:
        if len(expected_totals) != 1 or any(r["heat_number"] is None for r in races.values()):
            raise ValueError("Inconsistent heat labels")
        total = next(iter(expected_totals))
        numbers = [r["heat_number"] for r in races.values()]
        if len(numbers) != total or set(numbers) != set(range(1, total + 1)):
            raise ValueError("The selected pages do not contain every announced heat")
    elif len(races) != 1:
        raise ValueError("Multiple finals require explicit classification review")
    keys = [(r["race_id"], r["bib"]) for r in rows]
    if len(set(keys)) != len(keys):
        raise ValueError("Duplicate result within a heat")
    return {"event_number": str(event_number), "event_label_raw": next(iter(labels)),
            "heat_count": len(races), "heats": list(races.values()), "result_count": len(rows), "results": rows}


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("--file", type=Path, required=True)
    cli.add_argument("--roster", type=Path, required=True)
    cli.add_argument("--pages", type=int, nargs="+", required=True)
    cli.add_argument("--event-number", required=True)
    cli.add_argument("--output", type=Path, required=True)
    args = cli.parse_args()
    roster = json.loads(args.roster.read_text())
    digest = sha256(args.file.read_bytes()).hexdigest()
    if digest != roster["sha256"]:
        cli.error("PDF and roster hashes do not match")
    import pdfplumber
    with pdfplumber.open(args.file) as pdf:
        if any(p < 1 or p > len(pdf.pages) for p in args.pages):
            cli.error("A selected page is outside the PDF")
        event = parse_event_pages([(p, pdf.pages[p - 1].extract_text() or "") for p in args.pages], roster["observations"], args.event_number)
    result = {"parser_version": "tempus-complete-event/0.1", "status": "complete_selected_event",
              "source_id": roster["source_id"], "source_url": roster["source_url"], "sha256": digest,
              "pages": args.pages, **event}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Extracted {event['result_count']} results across {event['heat_count']} heats: {event['event_label_raw']}")


if __name__ == "__main__":
    main()
