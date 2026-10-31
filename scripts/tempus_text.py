"""Rejoin a supported two-line event title without inventing missing source text."""
import re


def join_event_headings(text):
    lines, joined, evidence = text.splitlines(), [], {}
    index = 0
    while index < len(lines):
        line = lines[index]
        if re.fullmatch(r".+ \d+ Semi- Event #\d+", line) and index + 1 < len(lines) and lines[index + 1] == "Finals":
            heading = line.replace(" Semi- Event #", " Semi-Finals Event #")
            evidence[heading] = [line, lines[index + 1]]
            joined.append(heading)
            index += 2
        else:
            joined.append(line)
            index += 1
    return "\n".join(joined), evidence
