"""Match competition-local names and retain reviewed roster field meanings."""
import json
from pathlib import Path
import re

AGE_SUFFIX = re.compile(r"\s+\((Jr\s+[A-E]|Sr|(?:Master\s+)?[MW]\s+\d+-\d+)\)$", re.IGNORECASE)
_FIELD_FILE = Path(__file__).resolve().parents[1] / "web/lib/imports/reviewed-roster-fields.json"
REVIEWED_ROSTER_FIELDS = {source["sha256"]: source for source in json.loads(_FIELD_FILE.read_text())["sources"]}


def roster_affiliation(source_hash, observation):
    raw = observation.get("affiliation_raw")
    for field in REVIEWED_ROSTER_FIELDS.get(source_hash, {}).get("affiliations", []):
        if (field["bib"], field["name"], field["page"], field["rosterValue"]) == (
            observation["bib"], observation["raw_name"], observation["page"], raw
        ):
            return field["resultValue"]
    return raw


def split_age_annotation(raw_name):
    match = AGE_SUFFIX.search(raw_name)
    return (raw_name[:match.start()], match[1]) if match else (raw_name, None)


def roster_name_is_consistent(observation):
    if observation["raw_name"] == observation["name"]:
        return True
    name, annotation = split_age_annotation(observation["raw_name"])
    status = observation.get("age_status_raw")
    return name == observation["name"] and annotation is not None and isinstance(status, str) and annotation.casefold() == status.casefold()


def result_name_matches(raw_name, observation):
    return roster_name_is_consistent(observation) and raw_name in {observation["name"], observation["raw_name"]}
