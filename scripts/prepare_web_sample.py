"""Prepare the verified sample slice consumed by the local/Sites application."""
import json
from hashlib import sha256
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def prepare():
    selected = [
        ("short-track", "st-agn-2026", "Short Track Age Group Nationals", "2026-03-20", "2026-03-22", "Norwood, MA"),
        ("long-track", "lt-agn-2026", "Long Track Age Group Nationals", "2026-02-14", "2026-02-15", "Roseville, MN"),
    ]
    records = []
    for discipline, competition_id, title, starts_on, ends_on, location in selected:
        roster = json.loads((ROOT / f"data/samples/{discipline}-agn-roster.json").read_text())
        race = json.loads((ROOT / f"data/samples/{discipline}-agn-event-1.json").read_text())
        if roster["issues"] or roster["sha256"] != race["sha256"]:
            raise ValueError(f"Source validation failed for {competition_id}")
        participants, entries = {}, []
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
        results = []
        for result in race["results"]:
            if result["bib"] not in participants:
                raise ValueError("A race result references an unknown participant")
            results.append({"id": f"{competition_id}:{result['race_id']}:{result['bib']}",
                            "participantId": f"{competition_id}:{result['bib']}", "raceId": result["race_id"],
                            "distance": result["distance_metres"], "round": result["round_raw"], "rank": result["rank"], "status": result["status_raw"],
                            "timeRaw": result["time_raw"], "timeMicroseconds": result["time_microseconds"],
                            "qualification": result["qualification_raw"], "sourcePage": result["source_page"],
                            "eventKey": sha256(f"{competition_id}|{result['event_label_raw']}".encode()).hexdigest()[:20],
                            "eventLabel": result["event_label_raw"], "raceLabel": result["race_label_raw"],
                            "heatNumber": result["heat_number"], "heatTotal": result["heat_total"]})
        records.append({"competition": {"id": competition_id, "title": title, "discipline": discipline,
                                        "season": "2025-2026", "startsOn": starts_on, "endsOn": ends_on, "location": location},
                        "source": {"id": roster["source_id"], "url": roster["source_url"], "sha256": roster["sha256"],
                                   "objectKey": f"samples/{roster['sha256']}.json"},
                        "participants": list(participants.values()), "entries": entries, "results": results,
                        "evidence": {"roster": roster, "race": race}})
    return {"schemaVersion": 2, "competitions": records}


if __name__ == "__main__":
    target = ROOT / "web/lib/sample-data.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(prepare(), indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Prepared {target.relative_to(ROOT)}")
