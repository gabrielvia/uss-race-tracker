"""Match exact competition-local names with supported source age annotations."""
import re

AGE_SUFFIX = re.compile(r"\s+\((Jr\s+[A-E]|Sr|(?:Master\s+)?[MW]\s+\d+-\d+)\)$", re.IGNORECASE)


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
