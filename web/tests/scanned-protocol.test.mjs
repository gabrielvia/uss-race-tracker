import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {harness} from './support.mjs';
const item=JSON.parse(readFileSync(new URL('../../data/samples/lt-amcup1-2027-protocol.json',import.meta.url)));
const payload=()=>({schemaVersion:3,coverage:'selected-events',baseBatchId:null,review:{reviewer:'Test source reviewer',seasonSourceLabel:'2026-2027',notes:'Whole reviewed scanned source; official places/times; independent lap-count mass start.',confirmed:true},item:structuredClone(item)});

test('scanned protocol preserves official inconsistent places/times and isolates lap-count results from PBs/trends',async()=>{
 const h=harness();try{
  const response=await h.request('imports','POST',payload()),batch=await response.json();
  assert.equal(response.status,200);assert.equal(batch.report.valid,true,JSON.stringify(batch.report.errors));assert.equal(batch.report.counts.results,370);
  h.objects.set('test-only-archive','%PDF-1.7\nTest-only placeholder');
  h.sqlite.prepare('INSERT INTO source_documents VALUES (?,?,?,?,?)').run(item.source.sha256,item.source.url,'test-only-archive',41,'2026-11-04T00:00:00Z');
  assert.equal((await h.request('imports/[id]/publish','POST',undefined,true,batch.id)).status,200);
  const detail=await(await h.request('competitions/[id]','GET',undefined,false,item.competition.id)).json();
  assert.equal(detail.results.length,370);assert.equal(detail.participants.length,70);assert.equal(detail.events.length,18);assert.equal(detail.events[0].label,"RESULT 500m Women #1");assert.equal(detail.events.at(-1).label,"Mass Start (16 Laps) Men / Elimination Race #2");
  const sourceSix=detail.results.filter(r=>r.source_page===6);
  assert.deepEqual(sourceSix.filter(r=>[15,16].includes(r.rank)).map(r=>[r.rank,r.source_name_raw,r.time_raw]),[[15,'Allison LA','45.59'],[16,'Evie FORRER','45.57']]);
  assert.ok(detail.results.every(r=>r.scope_status==='source-mapped'&&r.entry_id));
  assert.equal(detail.results.filter(r=>r.distance_unit==='laps').length,53);assert.ok(detail.participants.every(p=>p.affiliation===''&&p.country));
  assert.ok(detail.options.distance.some(o=>o.value==='laps:16'));
  const lap=await(await h.request('competitions/[id]?distance=laps%3A16','GET',undefined,false,item.competition.id)).json();
  assert.equal(lap.results.length,53);assert.ok(lap.results.every(r=>r.distance_unit==='laps'));
  const metres=await(await h.request('competitions/[id]?distance=16','GET',undefined,false,item.competition.id)).json();assert.equal(metres.results.length,0);
  const pb=await(await h.request('participants/[id]/personal-bests','GET',undefined,false,'lt-amcup1-2027:121')).json();
  assert.equal(pb.coverage.recorded_result_count,7);assert.equal(pb.coverage.comparable_result_count,5);assert.equal(pb.personalBests.length,3);assert.ok(pb.personalBests.every(b=>b.distance!==16));
  const chart=await(await h.request('performances?participant=lt-amcup1-2027%3A121&discipline=long-track&distance=16','GET',undefined,false)).json();assert.equal(chart.records.length,0);assert.ok(chart.options.every(o=>o.distance!==16));
  const missing=detail.results.find(r=>r.source_page===44&&r.participant_id.endsWith(':112'));
  assert.equal(missing.time_raw,null);assert.equal(missing.result_status,null);assert.equal(JSON.parse(missing.source_fields_json)['Cum. Split'],'9:54.140');
  assert.equal(JSON.parse(missing.source_fields_json).Time,null);
  assert.equal(detail.results.find(r=>r.source_page===9&&r.rank===8).time_microseconds,37441000);
  assert.equal(detail.results.find(r=>r.source_page===24&&r.rank===34).time_microseconds,43727000);
  assert.equal(detail.results.find(r=>r.source_page===32&&r.result_status==='DQ').qualification,'T08');
  assert.equal((await h.request('imports/[id]/publish','POST',undefined,true,batch.id)).status,200);assert.equal(h.sqlite.prepare('SELECT COUNT(*) n FROM results').get().n,370);
 }finally{h.close();}
});

test('scanned source proof rejects changed official values, missing rows, countries used as clubs and guessed lap distances',()=>{
 const h=harness();try{
  const {validate}=h.load(new URL('../lib/imports/validation.ts',import.meta.url).pathname);
  for(const mutate of [p=>p.item.results[14].timeRaw='45.58',p=>p.item.results[14].rank=16,p=>p.item.results.pop(),p=>p.item.participants[0].affiliation='USA',p=>p.item.results.at(-1).distance=6400,p=>p.item.results.at(-1).distanceUnit='metres',p=>p.item.protocol.scanned_pages.pop(),p=>p.item.source.sha256='a'.repeat(64),p=>p.item.evidence.roster.observations[0].age_status_raw='18']){
   const p=payload();mutate(p);assert.equal(validate(p).report.valid,false);
  }
 }finally{h.close();}
});

test('AmCup Final uses reviewed First Last names while retaining mixed races and mass-start spellings', async () => {
 const item = JSON.parse(readFileSync(new URL('../../data/samples/lt-amcup-final-2026-protocol.json', import.meta.url)));
 const h = harness();
 try {
  const candidate = {schemaVersion: 3, coverage: 'selected-events', baseBatchId: null,
   review: {reviewer: 'Source review', seasonSourceLabel: '2025-2026', notes: 'Exact scanned timing tables and name spellings reviewed.', confirmed: true}, item};
  const submitted = await h.request('imports', 'POST', candidate);
  const batch = await submitted.json();
  assert.equal(submitted.status, 200, JSON.stringify(batch.report.errors?.slice(0, 3)));
  h.objects.set('test-only-amcup-final-archive', '%PDF-Test-only');
  h.sqlite.prepare('INSERT INTO source_documents VALUES (?,?,?,?,?)').run(item.source.sha256, item.source.url, 'test-only-amcup-final-archive', 14, '2026-11-05T00:00:00Z');
  assert.equal((await h.request('imports/[id]/publish', 'POST', undefined, true, batch.id)).status, 200);

  const id = item.competition.id;
  const detail = await (await h.request('competitions/[id]', 'GET', undefined, false, id)).json();
  assert.equal(detail.results.length, 344);
  assert.equal(detail.participants.length, 87);
  assert.ok(detail.results.every(row => row.scope_status === 'source-mapped'));
  assert.equal(detail.results.filter(row => row.distance_unit === 'laps' && row.distance === 10).length, 58);
  assert.equal(detail.events.filter(event => event.gender === 'Mixed').length, 4);
  const person = detail.participants.find(row => row.bib === '257');
  assert.equal(person.name, 'Finn Siebert');
  const results = detail.results.filter(row => row.participant_id === person.id);
  assert.ok(results.some(row => row.source_name_raw === 'SIEBERT Finn' && row.country === 'USA'));
  assert.ok(results.some(row => row.source_name_raw === 'Sibert Finn' && row.country === null));
  const search = await (await h.request('skaters?q=Sibert%20Finn', 'GET')).json();
  assert.deepEqual(search.skaters.map(row => row.id), [person.id]);
  const bests = await (await h.request('participants/[id]/personal-bests', 'GET', undefined, false, person.id)).json();
  assert.equal(bests.coverage.recorded_result_count, results.length);
  assert.ok(bests.personalBests.flatMap(best => best.performances).every(row => row.distance_unit === 'metres'));
 } finally { h.close(); }
});

test('group tables retain overall places, one skater across groups, and exact fractional-distance bests', async () => {
 const item = JSON.parse(readFileSync(new URL('../../data/samples/st-socal-2026-protocol.json', import.meta.url)));
 const h = harness();
 try {
  const candidate = {...payload(), review: {...payload().review, seasonSourceLabel: '2025-2026'}, item};
  const submitted = await h.request('imports', 'POST', candidate);
  const batch = await submitted.json();
  assert.equal(submitted.status, 200, JSON.stringify(batch.report.errors?.slice(0, 3)));
  h.objects.set('test-only-socal-archive', '%PDF-Test-only');
  h.sqlite.prepare('INSERT INTO source_documents VALUES (?,?,?,?,?)').run(item.source.sha256, item.source.url, 'test-only-socal-archive', 14, '2026-11-05T00:00:00Z');
  assert.equal((await h.request('imports/[id]/publish', 'POST', undefined, true, batch.id)).status, 200);
  const id = item.competition.id;
  const detail = await (await h.request('competitions/[id]', 'GET', undefined, false, id)).json();
  assert.equal(detail.coverage.layout, 'group-table');
  assert.equal(detail.results.length, 77);
  assert.equal(detail.participants.length, 26);
  assert.ok(detail.participants.every(person => person.bib === ''));
  assert.ok(detail.results.every(row => row.rank === null && row.scope_status === 'source-mapped'));
  const elias = detail.participants.find(person => person.name === 'Elias Hurley');
  const entries = detail.entries.filter(entry => entry.participant_id === elias.id);
  assert.deepEqual(entries.map(entry => entry.division), ['Racing Group 1', 'Racing Group 5']);
  const finishes = detail.results.filter(row => row.participant_id === elias.id);
  assert.equal(finishes.length, 5);
  assert.equal(finishes.filter(row => row.result_status === 'DNS').length, 1);
  assert.deepEqual([...new Set(finishes.map(row => JSON.parse(row.source_fields_json)['Overall place']))].sort(), ['3rd', '4th']);

  const fractional = await h.request('competitions/[id]?distance=212.5', 'GET', undefined, false, id);
  assert.equal(fractional.status, 200);
  const filtered = await fractional.json();
  assert.equal(filtered.results.length, 8);
  assert.ok(filtered.results.every(row => row.distance === 212.5));
  const remi = detail.participants.find(person => person.name === 'Remi Jia');
  const pb = await (await h.request('participants/[id]/personal-bests', 'GET', undefined, false, remi.id)).json();
  assert.equal(pb.personalBests.find(row => row.distance === 212.5).time_microseconds, 43580000);
  const curve = await h.request(`performances?participant=${remi.id}&discipline=short-track&distance=212.5`, 'GET');
  assert.equal(curve.status, 200);
  assert.equal((await curve.json()).competitionBests[0].time_microseconds, 43580000);
 } finally { h.close(); }
});
