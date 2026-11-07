import { test } from 'node:test';
import assert from 'node:assert/strict';
import { harness } from './support.mjs';

test('coverage distinguishes directory audits from active publications and hash revisions', async () => {
  const h = harness();
  try {
    let response = await h.request('coverage','GET',undefined,false);
    let data = await response.json();
    assert.equal(response.headers.get('Cache-Control'),'no-store');
    assert.equal(data.published.competitionCount,0);
    assert.ok(data.directory.entries > 400);
    assert.ok(data.audit.auditedSources >= 2);
    await h.seed();
    data = await (await h.request('coverage','GET',undefined,false)).json();
    assert.equal(data.published.competitionCount,0,'bootstrap samples are not reviewed publications');
    const item = structuredClone(h.fixture.competitions[0]); delete item.source.objectKey;
    const batch = await (await h.request('imports','POST',{schemaVersion:2,coverage:'selected-event',baseBatchId:null,
      review:{reviewer:'Test',seasonSourceLabel:'2025-2026',notes:'Reviewed test publication',confirmed:true},item})).json();
    assert.equal((await h.request('imports/[id]/publish','POST',undefined,true,batch.id)).status,200);
    data = await (await h.request('coverage','GET',undefined,false)).json();
    assert.equal(data.published.competitionCount,1);
    assert.equal(data.published.resultCount,item.results.length);
    assert.deepEqual(data.published.seasons,['2025-2026']);
    assert.equal(data.published.competitions[0].auditStatus,'audited');
    h.sqlite.prepare('UPDATE sources SET sha256=?').run('b'.repeat(64));
    data = await (await h.request('coverage','GET',undefined,false)).json();
    assert.equal(data.published.competitions[0].auditStatus,'not-checked');
  } finally { h.close(); }
});
