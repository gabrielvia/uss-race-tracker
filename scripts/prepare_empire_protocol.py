"""Extract the reviewed Empire State Speedskating Pro layout without copying birth dates."""
import argparse
from hashlib import sha256
import json
from pathlib import Path
import re

from .inspect_speedskating_pro import PERSON, extract_results

SOURCE_HASH = '79708f9a2a31753a3932722e6681dc5bb8f9d1a4c8f46940982f130cb53c1258'
UNREADABLE_TIME = (24, '94', '142', '11:62:28.000')
OFFICIAL_MEMBER = ('DIVISION 2 Heartland M', '113', 'WANG Elias', 'USA-TSSC', 'USA-FMSC')


def display_name(raw):
    family, given = raw.split(' ', 1)
    return f'{given.title()} {family.title()}'


def roster_entry(person, division, page, gender=None):
    bib, name, member, _ = person.groups()
    return {'bib': bib, 'name': name, 'display_name': display_name(name), 'raw_name': name,
            'affiliation_raw': member, 'division_raw': division, 'age_status_raw': None, 'page': page,
            **({'gender': gender} if gender else {})}


def extract(file):
    import pdfplumber

    digest = sha256(file.read_bytes()).hexdigest()
    if digest != SOURCE_HASH:
        raise ValueError('Use the exact reviewed Empire State PDF.')
    with pdfplumber.open(file) as pdf:
        page_count = len(pdf.pages)
        texts = {n: pdf.pages[n - 1].extract_text(x_tolerance=1, y_tolerance=3) or '' for n in [3, *range(5, 22)]}
        columns = []
        for n in [4, *range(22, 32)]:
            page = pdf.pages[n - 1]
            divider = page.width / 2 if n == 4 else 316
            for column, (left, right) in enumerate([(0, divider), (divider, page.width)], 1):
                text = page.crop((left, 0, right, page.height)).extract_text(x_tolerance=1, y_tolerance=3) or ''
                columns.append({'page': n, 'column': column, 'text': text})

    roster, final, classifications, issues = {}, {}, [], []
    for column in columns[:2]:
        division = None
        for line in column['text'].splitlines():
            if line.startswith('DIVISION '):
                division = line
            elif re.match(r'^\d+ ', line):
                person = PERSON.fullmatch(line)
                if not person or not division or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', person[4]):
                    issues.append({'page': 4, 'reason': 'Unparsed competitor list row'})
                    continue
                entry = roster_entry(person, division, 4)
                key = (division, entry['bib'])
                if key in roster:
                    issues.append({'page': 4, 'reason': 'Duplicate scoped competitor list entry', 'bib': entry['bib']})
                roster[key] = entry

    for page in range(5, 22):
        text = texts[page]
        rows, division, gender = [], None, None
        for line in text.splitlines():
            if line.startswith(('FINAL CLASSIFICATION DIVISION ', 'DIVISION ')):
                division = line.removeprefix('FINAL CLASSIFICATION ')
                gender = 'Female' if division.endswith(' Heartland W') else 'Male' if division.endswith(' Heartland M') else None
            elif line in {'WOMEN', 'MEN'}:
                gender = {'WOMEN': 'Female', 'MEN': 'Male'}[line]
            if page < 8 and (rank := re.match(r'^(\d+)\. \( *\d+\. *\) (.+)$', line)):
                person = PERSON.fullmatch(rank[2])
                if not person or not division:
                    issues.append({'page': page, 'row': line, 'reason': 'Unparsed final classification row'})
                    continue
                entry = roster_entry(person, division, page, gender)
                key = (division, entry['bib'])
                if key in final:
                    issues.append({'page': page, 'reason': 'Repeated scoped final classification identity', 'bib': entry['bib']})
                final[key] = entry
                rows.append({'rank': int(rank[1]), 'bib': entry['bib'], 'row_raw': line})
            elif page >= 8 and re.match(r'^(?:\d+\.|DNS|DNF|PEN) ', line):
                rank = re.match(r'^(\d+)\.', line)
                rows.append({'rank': int(rank[1]) if rank else None, 'bib': None, 'row_raw': line})
        classifications.append({'page': page, 'kind': 'overall' if page < 8 else 'distance',
                                'label': text.splitlines()[1], 'text_raw': text, 'rows': rows})

    for key, entry in final.items():
        listed = roster.get(key)
        if listed:
            binding = (*key, listed['raw_name'], listed['affiliation_raw'], entry['affiliation_raw'])
            if listed['raw_name'] != entry['raw_name'] or listed['affiliation_raw'] != entry['affiliation_raw'] and binding != OFFICIAL_MEMBER:
                issues.append({'page': entry['page'], 'reason': 'Competitor list and final classification disagree',
                               'listed': listed, 'classification': entry})
            entry.update(listed_name=listed['raw_name'], listed_affiliation=listed['affiliation_raw'], listed_page=4)
        roster[key] = entry

    events, result_rows, races, row_issues = extract_results(
        columns[2:], roster, unreadable_times={UNREADABLE_TIME},
        ignored_lines={'Empires Shor', 'rt Track', 'Resul', 'lts', *(f'n Filipic Page {n} of 10' for n in range(1, 11))},
    )
    issues.extend(row_issues)
    supplementary = [{'page': 3, 'kind': 'infringement-report', 'label': 'Infringement report', 'text_raw': texts[3]}]
    return {'sha256': digest, 'page_count': page_count, 'roster': list(roster.values()), 'events': events,
            'classifications': classifications, 'supplementaryPages': supplementary, 'issues': issues,
            'summary': {'participants': len(roster), 'events': len(events), 'races': len(races), 'results': len(result_rows),
                        'classificationRows': sum(len(table['rows']) for table in classifications)},
            'pageAudit': {'cover': [1], 'officials': [2], 'supplementary': [3], 'competitorList': [4],
                          'classifications': list(range(5, 22)), 'results': list(range(22, 32))}}


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument('--file', type=Path, required=True)
    cli.add_argument('--output', type=Path, required=True)
    args = cli.parse_args()
    report = extract(args.file)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'summary': report['summary'], 'issues': len(report['issues'])}))


if __name__ == '__main__':
    main()
