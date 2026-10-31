"""Assemble checked complete events into the local/Sites sample competitions."""
import json
from hashlib import sha256
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def prepare_item(competition, roster, events):
    if not events or len(events) > 250 or roster["issues"]:
        raise ValueError("Provide one to 250 complete events and resolve roster issues first")
    participants, entries = {}, []
    competition_id = competition["id"]
    for position, observation in enumerate(roster["observations"]):
        bib = observation["bib"]
        participant_id = f"{competition_id}:{bib}"
        person = {"id": participant_id, "bib": bib, "name": observation["name"], "affiliation": observation["affiliation_raw"]}
        if bib in participants and participants[bib] != person:
            raise ValueError(f"Conflicting participant records for {participant_id}")
        participants[bib] = person
        entries.append({"id": f"{participant_id}:{position}", "participantId": participant_id,
                        "division": observation["division_raw"], "ageStatus": observation["age_status_raw"],
                        "rawName": observation["raw_name"], "sourcePage": observation["page"]})
    results, event_labels, race_ids, result_ids = [], set(), set(), set()
    for event in events:
        if any(event[key] != roster[key] for key in ["sha256", "source_id", "source_url"]):
            raise ValueError("Every selected event must refer to the roster's exact source revision")
        if event["parser_version"] not in {"tempus-complete-event/0.2", "tempus-complete-event/0.3", "tempus-complete-event/0.4"} or event["status"] != "complete_selected_event":
            raise ValueError("Regenerate complete selected events with the status-aware parser")
        if event["event_label_raw"] in event_labels:
            raise ValueError("A source event cannot be selected twice")
        event_labels.add(event["event_label_raw"])
        for heat in event["heats"]:
            if heat["race_id"] in race_ids:
                raise ValueError("Source race IDs cannot be reused across selected events")
            race_ids.add(heat["race_id"])
        for result in event["results"]:
            if result["bib"] not in participants:
                raise ValueError("A race result references an unknown participant")
            result_id = f"{competition_id}:{result['race_id']}:{result['bib']}"
            if result_id in result_ids:
                raise ValueError("Duplicate result across selected events")
            result_ids.add(result_id)
            results.append({"id": result_id, "participantId": f"{competition_id}:{result['bib']}",
                            "raceId": result["race_id"], "distance": result["distance_metres"], "round": result["round_raw"],
                            "rank": result["rank"], "status": result["status_raw"], "timeRaw": result["time_raw"],
                            "timeMicroseconds": result["time_microseconds"], "qualification": result["qualification_raw"],
                            "sourcePage": result["source_page"],
                            "eventKey": sha256(f"{competition_id}|{result['event_label_raw']}".encode()).hexdigest()[:20],
                            "eventLabel": result["event_label_raw"], "raceLabel": result["race_label_raw"],
                            "heatNumber": result["heat_number"], "heatTotal": result["heat_total"]})
            if "finish_note" in result:
                results[-1]["finishNote"] = result["finish_note"]
    return {"competition": dict(competition),
            "source": {"id": roster["source_id"], "url": roster["source_url"], "sha256": roster["sha256"],
                       "objectKey": f"samples/{roster['sha256']}.json"},
            "participants": list(participants.values()), "entries": entries, "results": results,
            "evidence": {"roster": roster, "events": events}}


def prepare(include_group_samples=False):
    selected = [
        ("short-track", "st-agn-2026", "Short Track Age Group Nationals", "2026-03-20", "2026-03-22", "Norwood, MA"),
        ("long-track", "lt-agn-2026", "Long Track Age Group Nationals", "2026-02-14", "2026-02-15", "Roseville, MN"),
    ]
    records = []
    for discipline, competition_id, title, starts_on, ends_on, location in selected:
        roster = json.loads((ROOT / f"data/samples/{discipline}-agn-roster.json").read_text())
        numbers = [1, 2] if discipline == "short-track" else [1, 6]
        if include_group_samples:
            numbers += ["9-group-a", "9-group-b"] if discipline == "short-track" else [5]
        events = [json.loads((ROOT / f"data/samples/{discipline}-agn-event-{number}.json").read_text()) for number in numbers]
        records.append(prepare_item({"id": competition_id, "title": title, "discipline": discipline,
                                     "season": "2025-2026", "startsOn": starts_on, "endsOn": ends_on, "location": location}, roster, events))
    return {"schemaVersion": 3, "competitions": records}


if __name__ == "__main__":
    target = ROOT / "web/lib/sample-data.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(prepare(), indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Prepared {target.relative_to(ROOT)}")
