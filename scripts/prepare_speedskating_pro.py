"""Prepare a complete, source-reviewed Speedskating Pro import; never publish it."""
import argparse
from hashlib import sha256
import json
from pathlib import Path

from .prepare_scanned_protocol import micros


def assemble(review):
    if review.get('reviewStatus') != 'reviewed' or review['issues']:
        raise ValueError('Resolve every extraction issue and record the whole-source review first.')
    competition = review['competition']
    cid = competition['id']
    proof = {k: review[k] for k in ['source_id', 'source_url', 'sha256']}
    participants, entries, observations = [], [], []
    for n, o in enumerate(review['roster']):
        scope = o['division_raw'].split()[1]
        pid = f"{cid}:d{scope}-{o['bib']}"
        participants.append({'id': pid, 'bib': o['bib'], 'name': o.get('display_name', o['name']), 'affiliation': o['affiliation_raw']})
        entries.append({'id': pid + ':entry', 'participantId': pid, 'division': o['division_raw'], 'ageStatus': None, 'rawName': o['raw_name'], 'sourcePage': o['page']})
        observations.append({**o, 'participant_id': pid})
    events, results = [], []
    for event in review['events']:
        number = 'RACE: ' + event['races'][0]['number']
        key = sha256(f"{cid}|{event['heading']}|{number}".encode()).hexdigest()[:20]
        raw_rows = []
        for r in event['rows']:
            race = r['race']
            pid = f"{cid}:d{event['division_number']}-{r['bib']}"
            rid = 'race' + race['number']
            fields = {'Place': r['place_raw'], 'BIB#': r['bib'], 'Name': r['name'], 'Member': r['member'], 'Time': r['time_raw_field'], 'Status': r['status_raw'], 'Qualification': r['qualification'], 'Points': r['points'], 'Division': event['division'], 'Round': event['round'], 'Distance': event['heading'].rsplit(event['round'] + ' ', 1)[1], 'Race': race['number'], 'Heat': f"{race['heat']}/{race['total']}", 'Group': race['group']}
            raw = {**proof, 'participant_id': pid, 'rank': r['rank'], 'status_raw': r['status'], 'row_raw': r['row_raw'], 'bib': r['bib'], 'name_raw': r['name'], 'affiliation_raw': r['member'], 'time_raw': r['time'], 'time_microseconds': micros(r['time']) if r['time'] else None, 'qualification_raw': r['qualification'], 'event_label_raw': event['heading'], 'event_number': number, 'distance_metres': event['distance'] if event['unit'] == 'metres' else None, **({'distance_laps': event['distance']} if event['unit'] == 'laps' else {}), 'distance_unit': event['unit'], 'event_kind': 'individual', 'round_raw': event['round'], 'race_id': rid, 'race_label_raw': race['heading'], 'source_page': r['page'], 'source_column': r['column'], 'group_label': event['division'], 'heat_number': race['heat'], 'heat_total': race['total'], 'lane_raw': None, 'points_raw': r['points'], 'behind_raw': None, 'source_fields': fields}
            row = {'id': f"{cid}:{rid}:{r['bib']}", 'participantId': pid, 'raceId': rid, 'distance': event['distance'], 'distanceUnit': event['unit'], 'eventKind': 'individual', 'round': event['round'], 'rank': r['rank'], 'status': r['status'], 'timeRaw': r['time'], 'timeMicroseconds': raw['time_microseconds'], 'qualification': r['qualification'], 'sourcePage': r['page'], 'eventKey': key, 'eventLabel': event['heading'], 'raceLabel': race['heading'], 'heatNumber': race['heat'], 'heatTotal': race['total'], 'sourceNameRaw': r['name'], 'lane': None, 'pointsRaw': r['points'], 'behindRaw': None, 'sourceFields': fields}
            if r['time'] is None and r['status'] is None:
                raw['finish_note'] = row['finishNote'] = 'Printed time cannot be interpreted.' if r.get('unreadable_time') else 'Time not recorded in source.'
            raw_rows.append(raw)
            results.append(row)
        heats = [{'race_id': 'race' + r['number'], 'label': r['heading'], 'heat_number': r['heat'], 'heat_total': r['total'], 'result_count': sum(x['race_id'] == 'race' + r['number'] for x in raw_rows)} for r in event['races']]
        events.append({**proof, 'parser_version': 'reviewed-speedskating-pro-event/1', 'status': 'complete_selected_event', 'pages': sorted({r['source_page'] for r in raw_rows}), 'event_number': number, 'event_label_raw': event['heading'], 'heat_count': len(heats), 'result_count': len(raw_rows), 'heats': heats, 'results': raw_rows})
    roster_pages = sorted({o['page'] for o in observations})
    roster = {**proof, 'parser_version': 'reviewed-speedskating-pro-roster/1', 'page_count': review['page_count'], 'observation_count': len(observations), 'distinct_bib_count': len({o['bib'] for o in observations}), 'roster_pages': roster_pages, 'observations': observations, 'issues': [], 'identity_basis': review.get('identityBasis', 'Literal final-classification names, members, genders and divisions; user-confirmed reused bibs remain separate.'), 'review_notes': review['reviewNotes'], 'page_audit': review['pageAudit']}
    classifications = review['classifications']
    protocol = {'parser_version': 'reviewed-speedskating-pro-protocol/1', 'sha256': review['sha256'], 'scanned_pages': list(range(1, review['page_count'] + 1)), 'event_labels': [e['event_label_raw'] for e in events], 'roster_verification': {'pages': roster_pages, 'observation_count': len(observations), 'exact_rows': True}, 'classification_pages': [c['page'] for c in classifications], 'classifications': classifications, 'supplementary_pages': review['supplementaryPages'], 'complete_results': True, 'result_count': len(results), 'issues': []}
    return {'competition': competition, 'source': {'id': review['source_id'], 'url': review['source_url'], 'sha256': review['sha256']}, 'participants': participants, 'entries': entries, 'results': results, 'evidence': {'roster': roster, 'events': events}, 'protocol': protocol}


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    for name in ['review', 'pdf', 'output']:
        cli.add_argument('--' + name, type=Path, required=True)
    args = cli.parse_args()
    review = json.loads(args.review.read_text())
    if sha256(args.pdf.read_bytes()).hexdigest() != review['sha256']:
        cli.error('Original PDF differs from the reviewed revision.')
    item = assemble(review)
    args.output.write_text(json.dumps(item, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'prepared': True, 'participants': len(item['participants']), 'events': len(item['evidence']['events']), 'results': len(item['results']), 'published': False}))


if __name__ == '__main__':
    main()
