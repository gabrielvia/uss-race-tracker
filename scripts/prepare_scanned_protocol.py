"""Assemble a whole, explicitly reviewed scanned timing protocol without guessing source values."""
import argparse
from collections import defaultdict
from hashlib import sha256
import json
from pathlib import Path
import re


def micros(raw):
    marked = re.fullmatch(r'(.*\.\d{2})\((\d)\)', raw)
    if marked:
        raw = marked[1] + marked[2]
    m = re.fullmatch(r'(?:(\d+):)?(\d{1,2})\.(\d{1,6})', raw)
    if not m or int(m[2]) >= 60:
        raise ValueError('Unsupported printed time; obtain source interpretation before importing it.')
    return (int(m[1] or 0) * 60 + int(m[2])) * 1_000_000 + int(m[3].ljust(6, '0'))


def assemble(review):
    if review['reviewStatus'] != 'reviewed':
        raise ValueError('The complete scanned extraction requires a recorded source review.')
    c = review['competition']; cid = c['id']
    proof = {k: review[k] for k in ['source_id', 'source_url', 'sha256']}
    observations = review['roster']
    participants = [{'id': f"{cid}:{o['bib']}", 'bib': o['bib'], 'name': o['name'], 'affiliation': '', 'country': o['country']} for o in observations]
    if len({p['id'] for p in participants}) != len(participants):
        raise ValueError('Review duplicate local participant observations explicitly.')
    entries = [{'id': f"{p['id']}:{i}", 'participantId': p['id'], 'division': o['division_raw'], 'ageStatus': o['age_status_raw'], 'rawName': o['raw_name'], 'sourcePage': o['page']} for i, (o, p) in enumerate(zip(observations, participants, strict=True))]
    roster = {**proof, 'parser_version': 'reviewed-scanned-roster/1', 'page_count': review['page_count'], 'observation_count': len(observations), 'distinct_bib_count': len(participants), 'roster_pages': sorted({o['page'] for o in observations}), 'issues': [], 'observations': observations, 'page_audit': review['pageAudit'], 'review_notes': review['reviewNotes']}
    definitions = [(6, 'RESULT 500m Women #1', 500, 'Women'), (9, 'RESULT 500m Men #1', 500, 'Men'), (11, 'RESULT 1000m Women #1', 1000, 'Women'), (12, 'RESULT 1000m Men #1', 1000, 'Men'), (16, 'RESULT 3000m Women', 3000, 'Women'), (18, 'RESULT 3000m Men', 3000, 'Men'), (20, 'RESULT 5000m Men', 5000, 'Men'), (24, 'RESULT 500m Men #2', 500, 'Men'), (26, 'RESULT 500m Women #2', 500, 'Women'), (31, 'RESULT 1500m Men', 1500, 'Men'), (34, 'RESULT 1500m Women', 1500, 'Women'), (36, 'RESULT 10000m Men', 10000, 'Men'), (39, 'RESULT 1000m Women #2', 1000, 'Women'), (42, 'RESULT 1000m Men #2', 1000, 'Men'), (44, 'Mass Start (16 Laps) Women / Elimination Race #1', 16, 'Women'), (46, 'Mass Start (16 Laps) Men / Elimination Race #1', 16, 'Men'), (48, 'Mass Start (16 Laps) Women / Elimination Race #2', 16, 'Women'), (50, 'Mass Start (16 Laps) Men / Elimination Race #2', 16, 'Men')]
    events, results = [], []
    for ordinal, (page, label, distance, group) in enumerate(definitions, 1):
        lap = page >= 44
        source_rows = [r for r in review['massStartRows' if lap else 'timedRows'] if r['page'] == page or page == 31 and r['page'] == 32]
        event_key = sha256(f'{cid}|{label}'.encode()).hexdigest()[:20]
        raw_rows, heats = [], defaultdict(list)
        for r in source_rows:
            race_id = f"e{ordinal}:" + ('mass-start' if lap else 'pair' + r['race'] if r['race'] else 'not-stated')
            race_label = label.split(' / ')[-1] if lap else 'Race ' + r['race'] if r['race'] else 'Race not stated in source'
            fields = {'Place' if lap else 'Rnk': str(r['rank']) if r['rank'] is not None else r['status'], 'Id' if lap else 'Nr': r['bib'], **({'First Name': r['name'].split(' ',1)[0], 'Last Name': r['name'].split(' ',1)[1]} if lap else {'Name': r['name']}), 'Affiliation' if lap else 'Country': r['country'], **({} if lap else {'Race': r['race']}), 'Lane': r['lane'], 'Time': r['time'] if lap else r['time'] if r['time'] is not None else r['status'], **({'Cum. Split': r['cumSplit'], 'Last Split T': r['lastSplit'], 'Laps': r['laps'], 'User 2': r['user2']} if lap else {'Behind': r['behind'], 'Points': r['points']})}
            raw = {**proof, 'rank': r['rank'], 'status_raw': r['status'], 'row_raw': '\t'.join(v or '' for v in fields.values()), 'bib': r['bib'], 'name_raw': r['name'], 'affiliation_raw': '', 'country_raw': r['country'], 'time_raw': r['time'], 'time_microseconds': micros(r['time']) if r['time'] else None, 'qualification_raw': r['qualification'], 'event_label_raw': label, 'event_number': label, 'distance_metres': None if lap else distance, **({'distance_laps': distance} if lap else {}), 'distance_unit': 'laps' if lap else 'metres', 'event_kind': 'mass-start' if lap else 'individual', 'round_raw': label.removeprefix('RESULT '), 'race_id': race_id, 'race_label_raw': race_label, 'source_page': r['page'], 'group_label': group, 'heat_number': None, 'heat_total': None, 'lane_raw': r['lane'], 'behind_raw': r['behind'], 'points_raw': r['points'], 'source_fields': fields}
            row = {'id': f"{cid}:{race_id}:{r['bib']}", 'participantId': f"{cid}:{r['bib']}", 'raceId': race_id, 'distance': distance, 'distanceUnit': raw['distance_unit'], 'eventKind': raw['event_kind'], 'round': raw['round_raw'], 'rank': r['rank'], 'status': r['status'], 'timeRaw': r['time'], 'timeMicroseconds': raw['time_microseconds'], 'qualification': r['qualification'], 'sourcePage': r['page'], 'eventKey': event_key, 'eventLabel': label, 'raceLabel': race_label, 'heatNumber': None, 'heatTotal': None, 'country': r['country'], 'sourceNameRaw': r['name'], 'lane': r['lane'], 'pointsRaw': r['points'], 'behindRaw': r['behind'], 'sourceFields': fields}
            if r['time'] is None and r['status'] is None:
                raw['finish_note'] = row['finishNote'] = 'Time not recorded in source.'
            raw_rows.append(raw);results.append(row);heats[race_id].append(raw)
        events.append({**proof, 'parser_version': 'reviewed-scanned-event/1', 'status': 'complete_selected_event', 'pages': sorted({r['source_page'] for r in raw_rows}), 'event_number': label, 'event_label_raw': label, 'heat_count': len(heats), 'result_count': len(raw_rows), 'heats': [{'race_id': race, 'label': rows[0]['race_label_raw'], 'heat_number': None, 'heat_total': None, 'result_count': len(rows)} for race, rows in heats.items()], 'results': raw_rows})
    if len(results) != len(review['timedRows']) + len(review['massStartRows']):
        raise ValueError('Every source row must be assigned to one source event.')
    return {'competition': c, 'source': {'id': review['source_id'], 'url': review['source_url'], 'sha256': review['sha256']}, 'participants': participants, 'entries': entries, 'results': results, 'evidence': {'roster': roster, 'events': events}, 'protocol': {'parser_version': 'reviewed-scanned-protocol/1', 'sha256': review['sha256'], 'scanned_pages': [p['page'] for p in review['pageAudit']], 'event_labels': [e['event_label_raw'] for e in events], 'roster_verification': {'pages': roster['roster_pages'], 'observation_count': len(observations), 'exact_rows': True}, 'classification_pages': [], 'complete_results': True, 'result_count': len(results), 'classifications': [], 'issues': []}}


def main():
    cli=argparse.ArgumentParser(description=__doc__)
    cli.add_argument('--review', type=Path, required=True);cli.add_argument('--pdf', type=Path, required=True);cli.add_argument('--output', type=Path, required=True)
    args=cli.parse_args();review=json.loads(args.review.read_text())
    if sha256(args.pdf.read_bytes()).hexdigest()!=review['sha256']:
        cli.error('The original PDF must match the reviewed source hash.')
    item=assemble(review);args.output.write_text(json.dumps(item,indent=2,ensure_ascii=False)+'\n')
    print(json.dumps({'prepared':True,'participants':len(item['participants']),'events':len(item['evidence']['events']),'results':len(item['results']),'published':False}))

if __name__=='__main__':main()
