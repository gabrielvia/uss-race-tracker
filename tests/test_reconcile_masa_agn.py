import io
import json
from copy import deepcopy
from hashlib import sha256
from pathlib import Path
import unittest
from unittest.mock import patch
from urllib.parse import urlsplit, parse_qs
from scripts.reconcile_masa_agn import reconcile

REVIEW = json.loads(Path('data/sources/masa-agn-identity-review.json').read_text())

class FakeApi:
    def __init__(self):
        self.posts = []
        self.wrong_hash = False
        self.links = {}
        for pair in REVIEW['pairs']:
            for key, name, club in [(pair['targetParticipantKey'], pair['displayName'], pair['targetAffiliation']), (pair['participantKey'], pair['sourceName'], pair['sourceAffiliation'])]:
                self.links[key] = dict(skater_id=sha256(('competition-skater|' + key).encode()).hexdigest()[:20], current_name=name, current_affiliation=club, status='competition-local', revision='3'*64, batch_id=('1' if key.startswith('st-agn') else '2')*64)
    def open(self, request, timeout=60):
        url = urlsplit(request.full_url)
        if request.data:
            d = json.loads(request.data)
            link = self.links[d['participantKey']]
            assert link['revision'] == d['expectedRevision'] and link['batch_id'] == d['expectedBatchId']
            self.posts.append(d)
            link.update(skater_id=d['skaterId'], status='reviewed', revision=sha256(request.data).hexdigest())
            result = dict(recorded=True, id=link['revision'])
        elif url.path.startswith('/api/competitions/'):
            result = {'competition': {'source_id': url.path.split('/')[-1]}}
        elif url.path.startswith('/api/sources/'):
            digest = REVIEW['sourceHash'] if url.path.endswith('st-masa-2026') else REVIEW['targetHash']
            result = {'roster': {'sha256': 'a'*64 if self.wrong_hash else digest}}
        elif url.path == '/api/imports':
            cid = parse_qs(url.query)['competition'][0]
            result = {'competitionId': cid, 'baseBatchId': ('1' if cid == 'st-agn-2026' else '2')*64}
        else:
            key = parse_qs(url.query)['participant'][0]
            result = {'link': deepcopy(self.links[key])}
        return io.BytesIO(json.dumps(result).encode())

class ReconcileTests(unittest.TestCase):
    def run_review(self, api, apply=False):
        with patch('scripts.reconcile_masa_agn.build_opener', return_value=api):
            return reconcile('https://example.test', {'seed_token': 'test-only'}, REVIEW, apply)
    def test_default_is_read_only_and_prepares_every_explicit_pair(self):
        api = FakeApi(); result = self.run_review(api)
        self.assertTrue(result['readOnly']); self.assertEqual(result['plannedDecisions'], 64); self.assertFalse(api.posts)
    def test_source_revision_drift_stops_before_any_identity_write(self):
        api = FakeApi(); api.wrong_hash = True
        with self.assertRaises(ValueError): self.run_review(api, True)
        self.assertFalse(api.posts)
    def test_unexpected_identity_is_not_overwritten(self):
        api = FakeApi(); api.links[REVIEW['pairs'][-1]['participantKey']]['status'] = 'needs_review'
        with self.assertRaises(ValueError): self.run_review(api, True)
        self.assertFalse(api.posts)
    def test_explicit_apply_and_resume_are_idempotent(self):
        api = FakeApi(); result = self.run_review(api, True)
        self.assertTrue(result['verified']); self.assertEqual(len(api.posts), 64)
        resumed = self.run_review(api, True)
        self.assertEqual(resumed['plannedDecisions'], 0); self.assertEqual(len(api.posts), 64)
