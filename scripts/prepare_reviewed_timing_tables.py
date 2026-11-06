"""Prepare a digest-checked scanned protocol from reviewed timing tables."""
import argparse
from collections import defaultdict
from hashlib import sha256
import json
from pathlib import Path

from .prepare_scanned_protocol import micros

STATUS_CODES = {"DNS", "DNF", "DQ", "WDR", "PEN", "FNT", "YC"}


def first_last(raw_name):
    words = raw_name.split()
    for index, word in enumerate(words):
        if not word.isupper() and word != "de":
            if index:
                return " ".join(words[index:] + words[:index]).title()
            break
    raise ValueError(f"Review the family and given name boundary: {raw_name}")


def assemble(review):
    if review["reviewStatus"] != "reviewed":
        raise ValueError("The complete scanned extraction requires a recorded source review.")
    competition = review["competition"]
    cid = competition["id"]
    proof = {key: review[key] for key in ["source_id", "source_url", "sha256"]}
    observations = review["roster"]
    participants = [
        {"id": f"{cid}:{o['bib']}", "bib": o["bib"], "name": o.get("display_name") or first_last(o["raw_name"]),
         "affiliation": "", "country": o["country"]}
        for o in observations
    ]
    people = {p["bib"]: p for p in participants}
    if len(people) != len(observations):
        raise ValueError("Roster bibs must be unique.")
    entries = [
        {"id": f"{p['id']}:{i}", "participantId": p["id"], "division": o["division_raw"],
         "ageStatus": None, "rawName": o["raw_name"], "sourcePage": o["page"]}
        for i, (o, p) in enumerate(zip(observations, participants, strict=True))
    ]
    roster_pages = sorted({o["page"] for o in observations})
    roster = {
        **proof, "parser_version": "reviewed-scanned-roster/1", "page_count": review["page_count"],
        "observation_count": len(observations), "distinct_bib_count": len(people),
        "roster_pages": roster_pages, "issues": [], "observations": observations,
        "page_audit": review["pageAudit"], "review_notes": review["reviewNotes"],
    }
    events, results = [], []
    for ordinal, table in enumerate(review["events"], 1):
        label = table["label"]
        event_key = sha256(f"{cid}|{label}".encode()).hexdigest()[:20]
        lap = table["unit"] == "laps"
        kind = "mass-start" if lap else "individual"
        raw_rows, heats = [], defaultdict(list)
        for record in table["rows"]:
            fields = record["fields"]
            if "Nr" in fields:
                number_field = "Nr"
            elif lap:
                number_field = "Helmet Number" if "Helmet Number" in fields else "Skater #"
            else:
                number_field = "No."
            source_bib = fields[number_field]
            bib = record.get("participantBib", source_bib)
            person = people[bib]
            country_code = fields.get("Country Code", fields.get("Country"))
            if country_code is not None and country_code != person["country"]:
                raise ValueError(f"Review conflicting country for bib {bib}.")
            raw_time = fields["Time"]
            status = record.get("status", raw_time if raw_time in STATUS_CODES else None)
            qualification = record.get("qualification")
            if status and (status not in STATUS_CODES or raw_time not in {status, status + (qualification or "")}):
                raise ValueError(f"Review the printed status for bib {bib}.")
            time = None if status else raw_time
            raw_rank = fields.get("Rank", fields.get("Rnk"))
            rank = int(raw_rank) if raw_rank else None
            lane = None if lap else fields["Lane"]
            points = fields.get("Total", fields.get("Race Points")) if lap else fields.get("Points")
            gap = None if lap else fields.get("Gap", fields.get("Behind"))
            pair = None if lap else fields.get("Pair", fields.get("Race"))
            race_id = f"e{ordinal}:mass-start" if lap else f"e{ordinal}:pair-{pair.lower()}"
            race_label = label if lap else f"Pair {pair}"
            country = {"country_raw": country_code} if country_code is not None else {}
            time_microseconds = micros(time) if time else None
            finish_note = {} if time or status else {"finish_note": "Time not recorded in source."}
            raw_rows.append({
                **proof, **country, **finish_note, "rank": rank, "status_raw": status,
                "row_raw": "\t".join(v if v is not None else "" for v in fields.values()),
                "bib": bib, **({"source_bib": source_bib} if bib != source_bib else {}),
                "name_raw": fields["Name"], "affiliation_raw": "", "time_raw": time,
                "time_microseconds": time_microseconds, "qualification_raw": qualification,
                "event_label_raw": label, "event_number": label,
                "distance_metres": None if lap else table["distance"],
                **({"distance_laps": table["distance"]} if lap else {}),
                "distance_unit": table["unit"], "event_kind": kind, "round_raw": label,
                "race_id": race_id, "race_label_raw": race_label, "source_page": record["page"],
                "group_label": table["group"], "heat_number": None, "heat_total": None,
                "lane_raw": lane, "behind_raw": gap, "points_raw": points, "source_fields": fields,
            })
            results.append({
                "id": f"{cid}:{race_id}:{bib}", "participantId": person["id"], "raceId": race_id,
                "distance": table["distance"], "distanceUnit": table["unit"], "eventKind": kind,
                "round": label, "rank": rank, "status": status, "timeRaw": time,
                "timeMicroseconds": time_microseconds, "qualification": qualification, "sourcePage": record["page"],
                "eventKey": event_key, "eventLabel": label, "raceLabel": race_label,
                "heatNumber": None, "heatTotal": None,
                **({"country": country_code} if country_code is not None else {}), "sourceNameRaw": fields["Name"],
                "lane": lane, "behindRaw": gap, "pointsRaw": points, "sourceFields": fields,
                **({"finishNote": finish_note["finish_note"]} if finish_note else {}),
            })
            heats[race_id].append(race_label)
        events.append({
            **proof, "parser_version": "reviewed-scanned-event/1", "status": "complete_selected_event",
            "pages": sorted({r["source_page"] for r in raw_rows}), "event_number": label, "event_label_raw": label,
            "heat_count": len(heats), "result_count": len(raw_rows),
            "heats": [{"race_id": key, "label": labels[0], "heat_number": None,
                       "heat_total": None, "result_count": len(labels)} for key, labels in heats.items()],
            "results": raw_rows,
        })
    if len({r["id"] for r in results}) != len(results):
        raise ValueError("Every timing row must have a distinct event, pair and skater key.")
    classifications = review.get("classifications", [])
    return {
        "competition": competition, "source": {"id": proof["source_id"], "url": proof["source_url"], "sha256": proof["sha256"]},
        "participants": participants, "entries": entries, "results": results,
        "evidence": {"roster": roster, "events": events},
        "protocol": {
            "parser_version": "reviewed-scanned-protocol/1", "sha256": proof["sha256"],
            "scanned_pages": [p["page"] for p in review["pageAudit"]],
            "event_labels": [event["event_label_raw"] for event in events],
            "roster_verification": {"pages": roster_pages, "observation_count": len(observations), "exact_rows": True},
            "classification_pages": [page["page"] for page in classifications],
            "complete_results": True, "result_count": len(results),
            "classifications": classifications, "issues": [],
        },
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("review", "pdf", "output"):
        parser.add_argument("--" + name, required=True, type=Path)
    args = parser.parse_args()
    review = json.loads(args.review.read_text())
    if sha256(args.pdf.read_bytes()).hexdigest() != review["sha256"]:
        parser.error("The original PDF must match the reviewed source hash.")
    item = assemble(review)
    args.output.write_text(json.dumps(item, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps({"participants": len(item["participants"]), "events": len(item["evidence"]["events"]), "results": len(item["results"])}))


if __name__ == "__main__":
    main()
