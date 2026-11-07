"""Build the reviewed SoCal group standings and distance-column import."""
import argparse
from hashlib import sha256
import json
from pathlib import Path

from .prepare_scanned_protocol import micros

PREFIX = "reviewed-group-table"


def assemble(review, pdf):
    if review["reviewStatus"] != "reviewed":
        raise ValueError("Resolve the source review before preparing the competition.")
    digest = sha256(pdf.read_bytes()).hexdigest()
    if digest != review["sha256"]:
        raise ValueError("The original PDF must match the reviewed source hash.")
    competition = review["competition"]
    cid = competition["id"]
    source = {"id": review["sourceId"], "url": review["sourceUrl"], "sha256": digest}
    proof = {"source_id": source["id"], "source_url": source["url"], "sha256": digest}
    participants, entries, observations, results, events = {}, [], [], [], []
    for group in review["groups"]:
        number, page = group["group"], group["page"]
        division = f"Racing Group {number}"
        roster_rows = []
        for index, row in enumerate(group["rows"], 1):
            place, name, region = row[:3]
            source_key = f"group-{number}-row-{index}"
            if name == "Elias Hurley" and number == 5:
                if review["confirmedSamePerson"] != name:
                    raise ValueError("Review the two Elias Hurley appearances.")
                source_key = "group-1-row-4"
                if participants[source_key]["name"] != name:
                    raise ValueError("The approved group and row no longer identify Elias Hurley.")
            pid = f"{cid}:{source_key}"
            participants.setdefault(source_key, {"id": pid, "bib": "", "name": name.title(), "affiliation": ""})
            entries.append({"id": f"{pid}:{number}", "participantId": pid, "division": division,
                            "ageStatus": row[-1], "rawName": name, "sourcePage": page})
            observations.append({"bib": source_key, "name": name, "raw_name": name, "affiliation_raw": "",
                                 "division_raw": division, "age_status_raw": row[-1], "page": page,
                                 "state_raw": region, "overall_place_raw": place})
            roster_rows.append((row, source_key))
        for occurrence, label in enumerate(group["distancesRaw"], 1):
            distance = float(label.removesuffix("m").strip())
            if distance.is_integer():
                distance = int(distance)
            heading = f"{division} · {label} (column {occurrence})"
            event_key = sha256(f"{cid}|{heading}".encode()).hexdigest()[:20]
            event_number = str(len(events) + 1)
            race_id, race_label = f"g{number}-c{occurrence}", f"Distance column {occurrence}"
            raw_rows = []
            for row, source_key in roster_rows:
                printed_time, points = row[2 * occurrence + 1:2 * occurrence + 3]
                status = printed_time if printed_time in {"DNS", "DNF", "PEN"} else None
                time = None if status else printed_time
                microseconds = micros(time) if time else None
                fields = {"Skater": row[1], "State": row[2], "Distance": label, "Time": printed_time,
                          "Points": points, "Overall place": row[0], "Overall points": row[-2],
                          "AG": row[-1], "Track (m)": group["trackMetres"]}
                raw_rows.append({
                    "rank": None, "status_raw": status, "row_raw": "\t".join(value or "" for value in row),
                    "bib": source_key, "name_raw": row[1], "affiliation_raw": "", "time_raw": time,
                    "time_microseconds": microseconds, "qualification_raw": None,
                    "event_label_raw": heading, "event_number": event_number,
                    "distance_metres": distance, "distance_unit": "metres", "event_kind": "individual",
                    "round_raw": "Group results", "race_id": race_id, "race_label_raw": race_label,
                    "source_page": page, "group_label": division, "heat_number": None, "heat_total": None,
                    "lane_raw": None, "behind_raw": None, "points_raw": points, "source_fields": fields,
                })
                results.append({
                    "id": f"{cid}:{race_id}:{source_key}", "participantId": participants[source_key]["id"],
                    "raceId": race_id, "distance": distance, "distanceUnit": "metres", "eventKind": "individual",
                    "round": "Group results", "rank": None, "status": status, "timeRaw": time,
                    "timeMicroseconds": microseconds, "qualification": None, "sourcePage": page,
                    "eventKey": event_key, "eventLabel": heading, "raceLabel": race_label,
                    "heatNumber": None, "heatTotal": None, "sourceNameRaw": row[1],
                    "lane": None, "behindRaw": None, "pointsRaw": points, "sourceFields": fields,
                })
            events.append({
                **proof, "parser_version": f"{PREFIX}-event/1", "status": "complete_selected_event",
                "pages": [page], "event_number": event_number, "event_label_raw": heading,
                "heat_count": 1, "result_count": len(raw_rows), "results": raw_rows,
                "heats": [{"race_id": race_id, "label": race_label, "heat_number": None,
                           "heat_total": None, "result_count": len(raw_rows)}],
            })
    if len(results) != review["observedResultCells"]:
        raise ValueError("Every populated distance cell must be accounted for.")
    pages = list(range(1, review["physicalPages"] + 1))
    roster = {
        **proof, "parser_version": f"{PREFIX}-roster/1", "page_count": len(pages),
        "observation_count": len(observations), "distinct_bib_count": len(participants),
        "roster_pages": pages, "observations": observations, "issues": [],
    }
    return {
        "source": source, "competition": competition, "participants": list(participants.values()),
        "entries": entries, "results": results, "evidence": {"roster": roster, "events": events},
        "protocol": {"parser_version": f"{PREFIX}-protocol/1", "sha256": digest, "scanned_pages": pages,
                     "event_labels": [e["event_label_raw"] for e in events],
                     "roster_verification": {"pages": pages, "observation_count": len(observations), "exact_rows": True},
                     "classification_pages": [], "classifications": [], "supplementary_pages": review["originalPages"],
                     "complete_results": True, "result_count": len(results), "issues": []},
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("review", "pdf", "output"):
        parser.add_argument("--" + name, required=True, type=Path)
    args = parser.parse_args()
    review = json.loads(args.review.read_text())
    item = assemble(review, args.pdf)
    args.output.write_text(json.dumps(item, indent=2, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    main()
