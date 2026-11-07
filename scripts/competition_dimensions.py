"""Evidence-backed browsing dimensions for the two reviewed AGN PDF revisions."""
from hashlib import sha256
import re
import json
from pathlib import Path
if __package__:
    from .tempus_text import MASA_HASH
else:
    from tempus_text import MASA_HASH

VERSION = "tempus-agn-dimensions/1"
MASA_VERSION = "tempus-masa-dimensions/1"
LT2025 = json.loads((Path(__file__).resolve().parents[1] / "web/lib/imports/long-track-2025-scopes.json").read_text())
OPEN_SCOPES = json.loads((Path(__file__).resolve().parents[1] / "web/lib/imports/open-division-scopes.json").read_text())
MASA_DIVISIONS = {"DeClemente", "Heo", "Kim", "Letai", "NEST MEN", "NEST WOMEN", "Santos", "Stoddard"}
REVIEWED_SOURCES = {
    "96baa4cc09283058cc4a458f6ced92316f2b029fa5b7d3cf75d6f371f848744f",
    "7a22b0b5b4713fae920d83e4ee500d40cee3aca58e23d3b895c774e1a88db45f",
}


def dimensions(item):
    open_scope = next((s for s in OPEN_SCOPES["sources"] if s["sha256"] == item["source"]["sha256"]), None)
    reviewed = item["source"]["sha256"] in REVIEWED_SOURCES
    masa = item["source"]["sha256"] == MASA_HASH
    lt2025 = item["source"]["sha256"] == LT2025["sha256"]
    people = {p["id"]: p["bib"] for p in item["participants"]}
    entries = []
    for entry in item["entries"]:
        observation = next((o for o in item["evidence"]["roster"]["observations"] if o["bib"] == people.get(entry["participantId"]) and o["division_raw"] == entry["division"] and o["page"] == entry["sourcePage"]), {})
        gender = {"Female": "Women", "Male": "Men"}.get(observation.get("gender"), "Unknown")
        match = re.fullmatch(r"(Junior [CDE]|Junior A-B-Senior|Combined|Master) (Men|Women)", entry["division"])
        division = (match[1] if match else entry["division"] if re.fullmatch(r"Group [12] Master", entry["division"]) else "Unknown") if reviewed else "Unknown"
        if masa and entry["division"] in MASA_DIVISIONS:
            division = entry["division"]
        if lt2025:
            division = next((e["division"] for e in LT2025["entries"] if e["raw"] == entry["division"]), "Unknown")
        if open_scope:
            division = next((s["division"] for s in open_scope["entries"] if s["raw"] == entry["division"] and s["gender"] in {gender, "Mixed"}), "Unknown")
        entries.append({"id": entry["id"], "gender": gender, "division": division, "page": entry["sourcePage"]})
    events = []
    for event in item["evidence"].get("events", [item["evidence"].get("race")]):
        if not event:
            continue
        raw = event["results"][0]["group_label"]
        prefix = re.fullmatch(r"(Group [AB]) (.+)", raw)
        group = prefix[2] if prefix else raw
        match = re.fullmatch(r"(Junior [CDE]|Junior A-B-Senior|Combined|Master) (Women's|Men's)", group)
        mixed = re.fullmatch(r"(Group [12] Master)'s", group)
        known = reviewed and bool(match or mixed)
        gender = ("Women" if match[2] == "Women's" else "Men") if match else "Mixed"
        events.append({"id": sha256(f"{item['competition']['id']}|{event['event_label_raw']}".encode()).hexdigest()[:20],
                       "gender": gender if known else "Unknown", "division": (match[1] if match else mixed[1]) if known else "Unknown",
                       "competitionGroup": prefix[1] if prefix else None,
                       "rawDivision": (f"{match[1]} {gender}" if match else mixed[1]) if known else None,
                       "pages": sorted({r["source_page"] for r in event["results"]}), "status": "source-mapped" if known else "needs-review"})
        masa_division = next((d for d in MASA_DIVISIONS if group == d + ("'" if d == "Santos" else "'s")), None)
        if masa and masa_division:
            events[-1].update(gender={"NEST MEN": "Men", "NEST WOMEN": "Women"}.get(masa_division, "Mixed"),
                              division=masa_division, rawDivision=masa_division, status="source-mapped")
        scope = next((e for e in LT2025["events"] if e["group"] == group), None) if lt2025 else None
        if scope:
            events[-1].update(gender=scope["gender"], division=scope["division"], rawDivision=scope["rawDivision"], status="source-mapped")
        scope = next((s for s in open_scope["entries"] if s["eventGroup"] == group), None) if open_scope else None
        if scope:
            events[-1].update(gender=scope["gender"], division=scope["division"], rawDivision=scope["raw"], status="source-mapped")
    event_map, entry_map = {e["id"]: e for e in events}, {e["id"]: e for e in entries}
    results = []
    for result in item["results"]:
        event = event_map.get(result["eventKey"], {})
        candidates = [e for e in item["entries"] if e["participantId"] == result["participantId"] and e["division"] == event.get("rawDivision") and (event["gender"] == "Mixed" or entry_map[e["id"]]["gender"] == event["gender"])]
        entry = entry_map[candidates[0]["id"]] if len(candidates) == 1 else {}
        results.append({"id": result["id"], "entryId": entry.get("id"), "gender": entry.get("gender", "Unknown"), "division": entry.get("division", "Unknown"), "status": "source-mapped" if entry else "needs-review"})
    return {"version": OPEN_SCOPES["version"] if open_scope else LT2025["version"] if lt2025 else MASA_VERSION if masa else VERSION, "entries": entries, "events": events, "results": results}
