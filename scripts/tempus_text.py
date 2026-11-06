"""Rejoin a supported two-line event title without inventing missing source text."""
import re
import json
from pathlib import Path

REVIEWED_LAYOUTS = {
    source["sha256"]: source
    for source in json.loads((Path(__file__).resolve().parents[1] / "web/lib/imports/reviewed-tempus-layouts.json").read_text())["sources"]
}
REVIEWED_TABLES = {s["sha256"]: s["pages"] for s in json.loads((Path(__file__).resolve().parents[1] / "web/lib/imports/reviewed-source-tables.json").read_text())["sources"]}
REVIEWED_FINAL_RACES = {
    (rule["sha256"], rule["eventLabel"]): rule["races"]
    for rule in json.loads((Path(__file__).resolve().parents[1] / "web/lib/imports/reviewed-final-races.json").read_text())
}
REVIEWED_EMPTY_ROSTERS = {
    (source["sha256"], page["page"]): page["text_raw"]
    for source in json.loads((Path(__file__).resolve().parents[1] / "web/lib/imports/reviewed-empty-rosters.json").read_text())
    for page in source["pages"]
}
REVIEWED_RACE_SCOPES = {
    (source["sha256"], event["label"]): {**event, "prefix": source["prefix"]}
    for source in json.loads((Path(__file__).resolve().parents[1] / "web/lib/imports/reviewed-race-scopes.json").read_text())
    for event in source["events"]
}


def reviewed_source_table(text, digest, page):
    return next((p for p in REVIEWED_TABLES.get(digest, []) if p["page"] == page and p["text_raw"] == text), None)


def protocol_page_text(page, digest, number):
    layout = REVIEWED_LAYOUTS.get(digest, {})
    if number not in layout.get("positionedSourceTablePages", []):
        return page.extract_text() or ""
    text = (page.dedupe_chars().extract_text(layout=True) or "").strip("\n")
    for original, reviewed in layout.get("positionedTextReplacements", {}).get(str(number), {}).items():
        text = text.replace(original, reviewed)
    return text


EVENT = re.compile(r"^(.+?)\s+(\d+)(?: \(#[2-4]\))?\s+(Heats|Quarter-Finals|Semi-Finals|Finals|Super Final Finals) Event #(\d+)$")
MASA_HASH = "2671f997837bdc170dfc1fc995fbe9431ea30df968678e51e62d350a72440ae2"
MASA_EMPTY_ROSTER = REVIEWED_EMPTY_ROSTERS[(MASA_HASH, 5)]


def reviewed_empty_roster(text, digest, page):
    return REVIEWED_EMPTY_ROSTERS.get((digest, page)) == text


def source_race_key(digest, event_label, race_id):
    scope = REVIEWED_RACE_SCOPES.get((digest, event_label))
    return f"{scope['prefix']}-{race_id}" if scope else race_id


def join_event_headings(text, source_hash=None):
    lines, joined, evidence = text.splitlines(), [], {}
    if REVIEWED_LAYOUTS.get(source_hash, {}).get("separateEventHeading") and len(lines) > 3 and lines[2] == "RESULTS":
        number = re.fullmatch(r"(?:(Group A) Picking 2(?:\+\(1\))? )?(Event #\d+)", lines[3])
        if number:
            heading = " ".join(filter(None, (number[1], lines[1], number[2])))
            if EVENT.fullmatch(heading):
                evidence[heading] = [lines[1], lines[3]]
                lines[3] = heading
    index = 0
    while index < len(lines):
        line = lines[index]
        if re.fullmatch(r".+ \d+ Semi- Event #\d+", line) and index + 1 < len(lines) and lines[index + 1] == "Finals":
            heading = line.replace(" Semi- Event #", " Semi-Finals Event #")
            evidence[heading] = [line, lines[index + 1]]
            joined.append(heading)
            index += 2
        elif index + 1 < len(lines) and ((re.fullmatch(r".+ \d+ Super Final Event #\d+", line) and lines[index + 1] == "Finals") or (re.fullmatch(r".+ \d+ Super Event #\d+", line) and lines[index + 1] == "Final Finals")):
            heading = re.sub(r" Super(?: Final)? Event #", " Super Final Finals Event #", line)
            evidence[heading] = [line, lines[index + 1]]
            joined.append(heading)
            index += 2
        else:
            joined.append(line)
            index += 1
    return "\n".join(joined), evidence
