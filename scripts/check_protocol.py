"""Read back one published full protocol, archived PDF and exact extraction evidence."""
import argparse
from hashlib import sha256
import json
from pathlib import Path
import sys
from urllib.error import HTTPError
from urllib.parse import urlencode,urlsplit
from urllib.request import Request,build_opener
if __package__:
    from .check_site import SameOriginRedirectHandler,credentials,validate_origin
else:
    from check_site import SameOriginRedirectHandler,credentials,validate_origin


def check_protocol(origin, secret, item):
    origin=validate_origin(origin);opener=build_opener(SameOriginRedirectHandler())
    def get(path, machine=False, binary=False):
        headers={}
        if secret.get('service_token'):headers['OAI-Sites-Authorization']='Bearer '+secret['service_token']
        if machine:headers['Authorization']='Bearer '+secret['seed_token']
        with opener.open(Request(origin+path,headers=headers),timeout=60) as response:
            data=response.read();return data if binary else json.loads(data)
    c=item['competition'];detail=get('/api/competitions/'+c['id'])
    assert detail['coverage']=={'kind':'protocol-results','eventCount':len(item['evidence']['events']),'completeCompetition':False}
    assert len(detail['participants'])==len(item['participants']) and len(detail['entries'])==len(item['entries'])
    expected={r['id']:r for r in item['results']};assert len(detail['results'])==len(expected)
    keys=[('participant_id','participantId'),('race_id','raceId'),('distance','distance'),('round','round'),('rank','rank'),('time_raw','timeRaw'),('time_microseconds','timeMicroseconds'),('qualification','qualification'),('source_page','sourcePage'),('event_key','eventKey'),('event_label','eventLabel'),('race_label','raceLabel'),('heat_number','heatNumber'),('heat_total','heatTotal'),('result_status','status'),('finish_note','finishNote')]
    for row in detail['results']:
        assert all(row[a]==expected[row['id']].get(b) for a,b in keys),'A published source result changed'
    for event in detail['events']:
        evidence=next(e for e in item['evidence']['events'] if e['event_label_raw']==event['label'])
        rows=[r for r in detail['results'] if r['event_key']==event['id']]
        assert event['result_count']==evidence['result_count']==len(rows)
        assert event['heat_count']==evidence['heat_count']==len({r['race_id'] for r in rows})
        assert all(r['event_label']==event['label'] and r['round']==event['round'] and r['distance']==event['distance'] for r in rows)
    evidence=get('/api/sources/'+detail['competition']['source_id'])
    assert {k:evidence[k] for k in ['roster','events']}==item['evidence']
    assert evidence['protocol']==item['protocol']
    assert detail['archivedPdf'] and sha256(get(detail['archivedPdf'],binary=True)).hexdigest()==item['source']['sha256']
    pages=get(detail['classificationsUrl'])['pages'];expected_pages=item['protocol']['classifications']
    assert len(pages)==len(expected_pages)
    for p,e in zip(pages,expected_pages):
        assert p['source_page']==e['page'] and all(p[k]==e[k] for k in ['kind','label','text_raw','rows'])
    scope=get('/api/competitions?'+urlencode({'discipline':c['discipline'],'season':c['season'],'q':c['title'],'page':1}))
    assert any(x['id']==c['id'] for x in scope['competitions'])
    assert all(x['discipline']==c['discipline'] and x['season']==c['season'] for x in scope['competitions'])
    if secret.get('seed_token'):
        history=get('/api/imports?'+urlencode({'competition':c['id'],'history':1}),True)
        assert history['total']>=1 and any(b['status']=='published' and b['source_hash']==item['source']['sha256'] for b in history['batches'])
    person=item['participants'][0];profile=get('/api/participants/'+person['id']+'/profile')
    assert profile['age']['status'] in {'inferred','range','lower_bound','not_available','conflict'}
    result={'passed':True,'competition':c['id'],'events':len(detail['events']),'results':len(expected),'classificationPages':len(pages),'archivedPdfVerified':True,'profileAgeStatus':profile['age']['status']}
    print(json.dumps(result),flush=True);return result


def main():
    cli=argparse.ArgumentParser(description=__doc__);cli.add_argument('--url',required=True);cli.add_argument('--item',type=Path,required=True);cli.add_argument('--local-credentials',type=Path)
    args=cli.parse_args();origin=validate_origin(args.url)
    if args.local_credentials:
        if urlsplit(origin).hostname not in {'localhost','127.0.0.1','::1'}:cli.error('--local-credentials is restricted to loopback')
        values=dict(line.split('=',1) for line in args.local_credentials.read_text().splitlines() if '=' in line and not line.startswith('#'));secret={'seed_token':values['SEED_TOKEN'].strip()}
    else:secret=credentials()
    check_protocol(origin,secret,json.loads(args.item.read_text()))

if __name__=='__main__':
    try:main()
    except (AssertionError,ValueError,OSError,KeyError) as error:
        print(f'Protocol verification failed ({type(error).__name__}).',file=sys.stderr);sys.exit(1)
