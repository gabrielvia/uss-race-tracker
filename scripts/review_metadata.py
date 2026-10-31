"""Read or submit explicit, revision-guarded identity and age-rule review records."""
import argparse
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


def main():
    cli=argparse.ArgumentParser(description=__doc__)
    cli.add_argument('action',choices=['identity','age-rule','identity-history','age-rule-history'])
    cli.add_argument('--url',required=True);cli.add_argument('--decision',type=Path);cli.add_argument('--participant');cli.add_argument('--competition');cli.add_argument('--local-credentials',type=Path)
    args=cli.parse_args();origin=validate_origin(args.url)
    write=args.action in {'identity','age-rule'}
    if write:
        if not args.decision:cli.error('--decision is required for an explicit review')
        data=args.decision.read_bytes()
        if len(data)>128*1024:cli.error('Review JSON exceeds 128 KiB')
        json.loads(data)
        path='/api/identity' if args.action=='identity' else '/api/age-rules'
    else:
        key=args.participant if args.action=='identity-history' else args.competition
        if not key:cli.error('Provide the participant key or competition ID for this history query')
        data=None;path=('/api/identity?'+urlencode({'participant':key})) if args.action=='identity-history' else ('/api/age-rules?'+urlencode({'competition':key}))
    if args.local_credentials:
        if urlsplit(origin).hostname not in {'localhost','127.0.0.1','::1'}:cli.error('--local-credentials is restricted to loopback')
        values=dict(line.split('=',1) for line in args.local_credentials.read_text().splitlines() if '=' in line and not line.startswith('#'));secret={'seed_token':values['SEED_TOKEN'].strip()}
    else:secret=credentials()
    if not secret.get('seed_token'):raise ValueError('A machine token is required')
    headers={'Content-Type':'application/json','Authorization':'Bearer '+secret['seed_token']}
    if secret.get('service_token'):headers['OAI-Sites-Authorization']='Bearer '+secret['service_token']
    request=Request(origin+path,headers=headers,data=data,method='POST' if write else 'GET')
    try:
        with build_opener(SameOriginRedirectHandler()).open(request,timeout=60) as response:status,result=response.status,json.load(response)
    except HTTPError as error:
        status=error.code
        try:result=json.loads(error.read())
        except (ValueError,UnicodeError):result={'error':'The service returned a non-JSON response.'}
    print(json.dumps({'httpStatus':status,'result':result},ensure_ascii=False,indent=2));return 0 if 200<=status<300 else 1


if __name__=='__main__':
    try:sys.exit(main())
    except (ValueError,OSError,KeyError) as error:
        print(f'Metadata review failed ({type(error).__name__}). Check the inputs and connection.',file=sys.stderr);sys.exit(1)
