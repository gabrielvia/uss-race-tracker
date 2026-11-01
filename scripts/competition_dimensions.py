"""Evidence-backed browsing dimensions for the two reviewed AGN PDF revisions."""
from hashlib import sha256
import re

VERSION = "tempus-agn-dimensions/1"
REVIEWED_SOURCES = {
    "96baa4cc09283058cc4a458f6ced92316f2b029fa5b7d3cf75d6f371f848744f",
    "7a22b0b5b4713fae920d83e4ee500d40cee3aca58e23d3b895c774e1a88db45f",
}


def dimensions(item):
    reviewed = item["source"]["sha256"] in REVIEWED_SOURCES
    people = {p["id"]: p["bib"] for p in item["participants"]}
    entries = []
    for entry in item["entries"]:
        observation = next((o for o in item["evidence"]["roster"]["observations"] if o["bib"] == people.get(entry["participantId"]) and o["division_raw"] == entry["division"] and o["page"] == entry["sourcePage"]), {})
        gender = {"Female": "Women", "Male": "Men"}.get(observation.get("gender"), "Unknown")
        match = re.fullmatch(r"(Junior [CDE]|Junior A-B-Senior|Combined|Master) (Men|Women)", entry["division"])
        division = (match[1] if match else entry["division"] if re.fullmatch(r"Group [12] Master", entry["division"]) else "Unknown") if reviewed else "Unknown"
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
    event_map, entry_map = {e["id"]: e for e in events}, {e["id"]: e for e in entries}
    results = []
    for result in item["results"]:
        event = event_map.get(result["eventKey"], {})
        candidates = [e for e in item["entries"] if e["participantId"] == result["participantId"] and e["division"] == event.get("rawDivision") and (event["gender"] == "Mixed" or entry_map[e["id"]]["gender"] == event["gender"])]
        entry = entry_map[candidates[0]["id"]] if len(candidates) == 1 else {}
        results.append({"id": result["id"], "entryId": entry.get("id"), "gender": entry.get("gender", "Unknown"), "division": entry.get("division", "Unknown"), "status": "source-mapped" if entry else "needs-review"})
    return {"version": VERSION, "entries": entries, "events": events, "results": results}
