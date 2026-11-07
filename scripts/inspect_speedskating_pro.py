"""Extract every original row from a supported two-column Speedskating Pro PDF.

This creates review evidence, never publishes it or marks it reviewed.
"""
import argparse
from collections import Counter
from hashlib import sha256
import json
from pathlib import Path
import re

from .prepare_scanned_protocol import micros

HEADER = re.compile(r'^(DIVISION (\d+) .+?) (SUPER FINAL|HEATS|FINAL) (\d+)\.? (m|Laps\.?)$')
RACE = re.compile(r'^RACE: (\d+) HEAT: (\d+)/(\d+)(?: GROUP: (\S+))?$')
MEMBER = r'(?:USA|CAN|HUN)(?:-\S+)?'
PERSON = re.compile(rf'^(\d+)\s+(.+?)\s+({MEMBER})(?:\s+|$)(.*)$')


def extract(path):
    import pdfplumber
    pages, columns = [], []
    with pdfplumber.open(path) as pdf:
        for number, page in enumerate(pdf.pages, 1):
            original_text = page.extract_text(x_tolerance=1, y_tolerance=3) or ''
            text = page.dedupe_chars(tolerance=0.1).extract_text(x_tolerance=1, y_tolerance=3) or ''
            pages.append({'page': number, 'text': text, **({'original_glyph_text': original_text, 'extraction_note': 'Identical overprinted glyphs at identical coordinates are de-duplicated for readable source text; no values are inferred.'} if text != original_text else {})})
            if text.startswith('Results\n'):
                for column, (left, right) in enumerate([(0, page.width / 2), (page.width / 2, page.width)], 1):
                    crop = page.crop((left, 0, right, page.height))
                    columns.append({'page': number, 'column': column, 'text': crop.extract_text(x_tolerance=1, y_tolerance=3) or ''})
            page.close()
    roster, classifications, issues = {}, [], []
    for page in pages:
        text, number = page['text'], page['page']
        if 'CLASSIFICATION' not in text:
            continue
        division, gender, rows = None, None, []
        for line in text.splitlines():
            if line.startswith('FINAL CLASSIFICATION DIVISION '):
                division = line.removeprefix('FINAL CLASSIFICATION ')
            elif line in ['WOMEN', 'MEN']:
                gender = {'WOMEN': 'Female', 'MEN': 'Male'}[line]
            elif text.startswith('FINAL CLASSIFICATION') and (m := re.match(r'^\d+\.\s+\(\s*\d+\.\s*\)\s+(.+)$', line)):
                person = PERSON.fullmatch(m[1])
                if not person or not division or not gender:
                    issues.append({'page': number, 'line': line, 'reason': 'Unparsed final classification identity'})
                    continue
                bib, name, member, _ = person.groups()
                key = (division, bib)
                observation = {'bib': bib, 'name': name, 'raw_name': name, 'affiliation_raw': member, 'division_raw': division, 'gender': gender, 'age_status_raw': None, 'page': number, 'row_raw': line}
                if key in roster:
                    issues.append({'page': number, 'line': line, 'reason': 'Repeated scoped identity'})
                roster[key] = observation
            if re.match(r'^(?:\d+\.|DNS|DNF|PEN)\s+', line):
                rows.append({'rank': int(line.split('.')[0]) if re.match(r'^\d+\.', line) else None, 'bib': None, 'row_raw': line})
        classifications.append({'page': number, 'kind': 'overall' if text.startswith('FINAL') else 'distance', 'label': text.splitlines()[0], 'text_raw': text, 'rows': rows})
    events, result_rows, race_numbers, result_issues = extract_results(columns, roster)
    issues.extend(result_issues)
    by_bib = Counter(o['bib'] for o in roster.values())
    return {'parser_version': 'speedskating-pro-extraction/1', 'sha256': sha256(path.read_bytes()).hexdigest(), 'page_count': len(pages), 'pages': pages, 'columns': columns, 'roster': list(roster.values()), 'events': events, 'classifications': classifications, 'issues': issues, 'summary': {'participants': len(roster), 'distinctBibs': len(by_bib), 'reusedBibs': {k: n for k, n in by_bib.items() if n > 1}, 'events': len(events), 'races': len(race_numbers), 'results': len(result_rows), 'classifications': sum(len(c['rows']) for c in classifications), 'statusCounts': dict(Counter(r['status'] for r in result_rows)), 'lapRows': sum(len(e['rows']) for e in events if e['unit'] == 'laps')}}


def extract_results(columns, roster, *, unreadable_times=(), ignored_lines=()):
    events, result_rows, race_numbers, issues = [], [], set(), []
    event, race = None, None
    for column in columns:
        for line in column['text'].splitlines():
            if m := HEADER.fullmatch(line):
                division, division_number, round_raw, distance, unit = m.groups()
                event = {'heading': line, 'division': division, 'division_number': division_number, 'round': round_raw, 'distance': int(distance), 'unit': 'metres' if unit == 'm' else 'laps', 'rows': [], 'races': []}
                events.append(event)
                race = None
            elif m := RACE.fullmatch(line):
                if event is None:
                    issues.append({'page': column['page'], 'line': line, 'reason': 'Race without event'})
                    continue
                number, heat, total, group = m.groups()
                if number in race_numbers:
                    issues.append({'page': column['page'], 'line': line, 'reason': 'Duplicate source race'})
                race_numbers.add(number)
                race = {'number': number, 'heat': int(heat), 'total': int(total), 'group': group, 'heading': line}
                event['races'].append(race)
            elif re.match(r'^\d', line):
                if race is None or event is None:
                    issues.append({'page': column['page'], 'line': line, 'reason': 'Row without event/race'})
                    continue
                place = re.match(r'^(\d+)\.\s+(.+)$', line)
                person = PERSON.fullmatch(place[2] if place else line)
                if not person:
                    issues.append({'page': column['page'], 'line': line, 'reason': 'Unparsed result row'})
                    continue
                bib, name, member, tail = person.groups()
                identity = roster.get((event['division'], bib))
                if not identity or (identity['name'], identity['affiliation_raw']) != (name, member):
                    issues.append({'page': column['page'], 'line': line, 'reason': 'Result/identity conflict', 'division': event['division']})
                status, status_raw, time, rest = None, None, None, ''
                unreadable = (column['page'], race['number'], bib, tail.split(' ', 1)[0]) in unreadable_times
                if tail.startswith('- '):
                    match = re.fullmatch(r'(- (?:no start|no finish|penalty))(?:\s+(.*))?', tail)
                    if not match:
                        issues.append({'page': column['page'], 'line': line, 'reason': 'Unsupported source status'})
                        continue
                    status_raw, rest = match[1], match[2] or ''
                    status = {'- no start': 'DNS', '- no finish': 'DNF', '- penalty': 'PEN'}[status_raw]
                elif unreadable:
                    _, _, rest = tail.partition(' ')
                elif tail.startswith('NO TIME'):
                    rest = tail.removeprefix('NO TIME').strip()
                else:
                    time, _, rest = tail.partition(' ')
                    try:
                        micros(time)
                    except ValueError:
                        issues.append({'page': column['page'], 'line': line, 'reason': 'Unsupported source time'})
                        continue
                point_match = re.search(r'(?:^|\s)(\d+(?:\.\d+)?|#+)$', rest)
                points = point_match[1] if point_match else None
                qualification = rest[:point_match.start()].strip() if point_match else rest
                row = {'page': column['page'], 'column': column['column'], 'row_raw': line, 'bib': bib, 'name': name, 'member': member, 'rank': int(place[1]) if place else None, 'place_raw': place[1] + '.' if place else None, 'time': time, 'time_raw_field': tail.split(' ', 1)[0] if unreadable else 'NO TIME' if tail.startswith('NO TIME') else time, **({'unreadable_time': True} if unreadable else {}), 'status': status, 'status_raw': status_raw, 'qualification': qualification or None, 'points': points, 'race': race.copy()}
                event['rows'].append(row)
                result_rows.append(row)
            elif line in ignored_lines or line in ['Re', 'esults', 'Results'] or line.startswith(('Date and Time of Issue', 'Hermann Filipic')) or not line:
                continue
            else:
                issues.append({'page': column['page'], 'column': column['column'], 'line': line, 'reason': 'Unaccounted result-page text'})
    for event in events:
        if not event['races'] or not event['rows']:
            issues.append({'heading': event['heading'], 'reason': 'Empty event'})
        actual = [r['heat'] for r in event['races']]
        total = {r['total'] for r in event['races']}
        if len(total) != 1 or sorted(actual) != list(range(1, next(iter(total), 0) + 1)):
            issues.append({'heading': event['heading'], 'reason': 'Incomplete event heats', 'heats': actual})
    return events, result_rows, race_numbers, issues


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument('--file', type=Path, required=True)
    cli.add_argument('--output', type=Path, required=True)
    args = cli.parse_args()
    report = extract(args.file)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'summary': report['summary'], 'issues': report['issues']}, ensure_ascii=False))


if __name__ == '__main__':
    main()
