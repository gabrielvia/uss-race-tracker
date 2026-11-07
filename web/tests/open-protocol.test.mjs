import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {harness} from './support.mjs';
const item=JSON.parse(readFileSync(new URL('../../data/samples/st-nutricost-2027-protocol.json',import.meta.url)));
delete item.source.objectKey;
const payload=()=>({schemaVersion:3,coverage:'selected-events',baseBatchId:null,review:{reviewer:'Test source review',seasonSourceLabel:'2026-2027',notes:'All72 physical pages and856 official rows independently verified; no inferred ages or identities.',confirmed:true},item:structuredClone(item)});

test('open Tempus protocol retains complete Heats, second-distance occurrences and source-only age categories',async()=>{
 const h=harness();try{
  const response=await h.request('imports','POST',payload()),batch=await response.json();assert.equal(response.status,200,JSON.stringify(batch.report.errors));assert.equal(batch.report.coverage,'protocol-results');
  h.objects.set('test-only-nutricost-archive','%PDF-Test-only');h.sqlite.prepare('INSERT INTO source_documents VALUES (?,?,?,?,?)').run(item.source.sha256,item.source.url,'test-only-nutricost-archive',14,'2026-11-05T00:00:00Z');assert.equal((await h.request('imports/[id]/publish','POST',undefined,true,batch.id)).status,200);
  const detail=await(await h.request('competitions/[id]','GET',undefined,false,item.competition.id)).json();assert.equal(detail.results.length,856);assert.equal(detail.events.length,38);assert.equal(detail.participants.length,57);assert.ok(detail.results.every(r=>r.scope_status==='source-mapped'));
  const heats=detail.events.filter(e=>e.round==='Heats');assert.equal(heats.length,4);assert.ok(heats.every(e=>e.heat_count===8));assert.equal(detail.events.filter(e=>e.label.includes('(#2)')).length,19);
  assert.ok(detail.entries.every(e=>e.division_key===e.division&&['Men','Women'].includes(e.division)));
  const person=item.participants.find(p=>p.name==='Daniel Chen'),profile=await(await h.request('participants/[id]/profile','GET',undefined,false,person.id)).json();assert.equal(profile.age.status,'not_available');assert.ok(detail.entries.some(e=>e.age_status==='U15'));
  const expected=item.results.filter(r=>r.participantId===person.id),pb=await(await h.request('participants/[id]/personal-bests','GET',undefined,false,person.id)).json();assert.equal(pb.coverage.recorded_result_count,expected.length);
  for(const best of pb.personalBests)assert.equal(best.time_microseconds,Math.min(...expected.filter(r=>r.distance===best.distance&&r.status===null&&r.timeMicroseconds>0).map(r=>r.timeMicroseconds)));
  assert.equal((await h.request('imports/[id]/publish','POST',undefined,true,batch.id)).status,200);assert.equal(h.sqlite.prepare('SELECT COUNT(*) n FROM results').get().n,856);
 }finally{h.close();}
});

test('Heats contract rejects missing announced heats, unsupported older-parser claims and false division bindings',()=>{
 const h=harness();try{const {validate}=h.load(new URL('../lib/imports/validation.ts',import.meta.url).pathname);
  for(const change of [p=>p.item.evidence.events[0].parser_version='tempus-complete-event/0.6',p=>p.item.evidence.events[0].heats.pop(),p=>p.item.entries[0].division='Women',p=>p.item.results[0].round='Finals',p=>p.item.results[0].timeMicroseconds+=1]){const p=payload();change(p);assert.equal(validate(p).report.valid,false);}
 }finally{h.close();}
});

test('mixed Challenge divisions preserve each original roster gender and independent gender filters',async()=>{
 const source=JSON.parse(readFileSync(new URL('../../data/samples/st-oval-fall-2026-protocol.json',import.meta.url)));delete source.source.objectKey;
 const h=harness();try{
  const p=payload();p.item=source;const submitted=await h.request('imports','POST',p),batch=await submitted.json();assert.equal(submitted.status,200,JSON.stringify(batch.report.errors));
  h.objects.set('test-only-oval-archive','%PDF-Test-only');h.sqlite.prepare('INSERT INTO source_documents VALUES (?,?,?,?,?)').run(source.source.sha256,source.source.url,'test-only-oval-archive',14,'2026-11-05T00:00:00Z');assert.equal((await h.request('imports/[id]/publish','POST',undefined,true,batch.id)).status,200);
  const detail=await(await h.request('competitions/[id]','GET',undefined,false,source.competition.id)).json();assert.equal(detail.results.length,298);assert.equal(detail.events.length,21);assert.ok(detail.events.every(e=>e.gender==='Mixed'));assert.ok(detail.results.every(r=>r.scope_status==='source-mapped'));
  for(const entry of detail.entries){const o=source.evidence.roster.observations.find(o=>o.bib===detail.participants.find(p=>p.id===entry.participant_id).bib);assert.equal(entry.gender,o.gender==='Male'?'Men':'Women');assert.equal(entry.division_key,o.division_raw);assert.equal(entry.age_status,null);}
  const byGender={};for(const gender of ['Men','Women','Mixed'])byGender[gender]=await(await h.request('competitions/[id]?gender='+gender,'GET',undefined,false,source.competition.id)).json();
  assert.equal(byGender.Mixed.results.length,298);assert.equal(byGender.Men.results.length+byGender.Women.results.length,298);assert.ok(byGender.Men.results.every(r=>r.gender==='Men'));assert.ok(byGender.Women.results.every(r=>r.gender==='Women'));
  for(const person of source.participants){const profile=await(await h.request('participants/[id]/profile','GET',undefined,false,person.id)).json();assert.equal(profile.age.status,'not_available');}
 }finally{h.close();}
});

test('Carl retains both Aiden Yu profiles, school evidence, and the reviewed club text', async () => {
 const carl = JSON.parse(readFileSync(new URL('../../data/samples/st-carl-2026-protocol.json', import.meta.url)));
 delete carl.source.objectKey;
 const h = harness();
 try {
  const candidate = {...payload(), item: carl};
  const {validate} = h.load(new URL('../lib/imports/validation.ts', import.meta.url).pathname);
  const wrongAge = structuredClone(candidate);
  const school = wrongAge.item.evidence.roster.observations.find(row => row.bib === '26');
  school.age_status_raw = school.school_raw;
  assert.ok(validate(wrongAge).report.errors.some(issue => issue.code === 'ROSTER_STATUS_COLUMN'));

  const submitted = await h.request('imports', 'POST', candidate);
  const batch = await submitted.json();
  assert.equal(submitted.status, 200, JSON.stringify(batch.report.errors));
  h.objects.set('test-only-carl-archive', '%PDF-Test-only');
  h.sqlite.prepare('INSERT INTO source_documents VALUES (?,?,?,?,?)').run(carl.source.sha256, carl.source.url, 'test-only-carl-archive', 14, '2026-11-05T00:00:00Z');
  assert.equal((await h.request('imports/[id]/publish', 'POST', undefined, true, batch.id)).status, 200);

  const id = carl.competition.id;
  const detail = await (await h.request('competitions/[id]', 'GET', undefined, false, id)).json();
  assert.equal(detail.results.length, 289);
  assert.ok(detail.entries.every(row => row.age_status === null));
  const aidens = detail.participants.filter(person => person.name === 'Aiden Yu');
  assert.deepEqual(aidens.map(person => person.bib).sort(), ['26', '54']);
  for (const person of aidens) {
   const pb = await (await h.request('participants/[id]/personal-bests', 'GET', undefined, false, person.id)).json();
   assert.equal(pb.coverage.recorded_result_count, 5);
   assert.ok(pb.personalBests.flatMap(best => best.performances).every(row => row.participant_id === person.id));
  }
  assert.equal(detail.participants.find(person => person.bib === '58').affiliation, 'Richmond Rockets');
  const evidence = await (await h.request('sources/[id]', 'GET', undefined, false, detail.competition.source_id)).json();
  assert.equal(evidence.roster.observations.find(row => row.bib === '58').affiliation_raw, 'Richmond Rock');
  assert.equal(evidence.roster.observations.find(row => row.bib === '26').school_raw, 'The Prairie School');
  const tables = await (await h.request('competitions/[id]/source-tables', 'GET', undefined, false, id)).json();
  assert.deepEqual(tables.pages, carl.protocol.supplementary_pages);
  assert.equal(tables.pages[0].kind, 'school-standings');
 } finally { h.close(); }
});

test('Desert Classic preserves repeated finals, third-distance headings and points-first classifications', async () => {
 const source = JSON.parse(readFileSync(new URL('../../data/samples/st-desert-2026-protocol.json', import.meta.url)));
 delete source.source.objectKey;
 const candidate = {...payload(), item: source};
 const h = harness();
 try {
  const {validate} = h.load(new URL('../lib/imports/validation.ts', import.meta.url).pathname);
  const changedFinal = structuredClone(candidate);
  changedFinal.item.evidence.events.find(event => event.event_label_raw === "Open B's 1500 Finals Event #53").heats[2].label = 'C Final Race #5303';
  assert.ok(validate(changedFinal).report.errors.some(issue => issue.code === 'FINAL_RACE_SOURCE'));
  const changedPlace = structuredClone(candidate);
  changedPlace.item.protocol.classifications.find(page => page.page === 22).rows.at(-1).rank = 0;
  assert.ok(validate(changedPlace).report.errors.some(issue => issue.code === 'CLASSIFICATION_SOURCE'));

  const submitted = await h.request('imports', 'POST', candidate);
  const batch = await submitted.json();
  assert.equal(submitted.status, 200, JSON.stringify(batch.report.errors?.slice(0, 3)));
  h.objects.set('test-only-desert-archive', '%PDF-Test-only');
  h.sqlite.prepare('INSERT INTO source_documents VALUES (?,?,?,?,?)').run(source.source.sha256, source.source.url, 'test-only-desert-archive', 14, '2026-11-05T00:00:00Z');
  assert.equal((await h.request('imports/[id]/publish', 'POST', undefined, true, batch.id)).status, 200);
  const id = source.competition.id;
  const detail = await (await h.request('competitions/[id]', 'GET', undefined, false, id)).json();
  assert.equal(detail.results.length, 1644);
  assert.equal(detail.events.length, 96);
  assert.ok(detail.results.every(row => row.scope_status === 'source-mapped'));
  assert.equal(detail.events.filter(event => event.label.includes('(#3)')).length, 4);
  const finals = new Map(detail.results.filter(row => /^530[123]$/.test(row.race_id)).map(row => [row.race_id, row.race_label]));
  assert.deepEqual([...finals], [['5301','B Final Race #5301'],['5302','A Final Race #5302'],['5303','B Final Race #5303']]);
  const classifications = await (await h.request('competitions/[id]/classifications', 'GET', undefined, false, id)).json();
  const dns = classifications.pages.find(page => page.source_page === 22).rows.at(-1);
  assert.deepEqual(dns, {rank: null, bib: '341', row_raw: '0 341 Gatesfield Hong EVD DNS'});
 } finally { h.close(); }
});

test('Washington State publishes one race set and preserves both official standings and starred source names', async () => {
 const source = JSON.parse(readFileSync(new URL('../../data/samples/st-washington-2026-protocol.json', import.meta.url)));
 delete source.source.objectKey;
 const h = harness();
 try {
  const submitted = await h.request('imports', 'POST', {...payload(), item: source});
  const batch = await submitted.json();
  assert.equal(submitted.status, 200, JSON.stringify(batch.report.errors?.slice(0, 3)));
  h.objects.set('test-only-washington-archive', '%PDF-Test-only');
  h.sqlite.prepare('INSERT INTO source_documents VALUES (?,?,?,?,?)').run(source.source.sha256, source.source.url, 'test-only-washington-archive', 14, '2026-11-05T00:00:00Z');
  assert.equal((await h.request('imports/[id]/publish', 'POST', undefined, true, batch.id)).status, 200);
  const id = source.competition.id;
  const detail = await (await h.request('competitions/[id]', 'GET', undefined, false, id)).json();
  assert.equal(detail.competition.starts_on, '2026-04-04');
  assert.equal(detail.competition.ends_on, '2026-04-05');
  assert.equal(detail.results.length, 357);
  assert.equal(detail.events.length, 56);
  assert.ok(detail.results.every(row => row.scope_status === 'source-mapped'));
  assert.ok(detail.events.some(event => event.label === "Division 7's 500 (#4) Finals Event #47"));
  const tables = await (await h.request('competitions/[id]/source-tables', 'GET', undefined, false, id)).json();
  assert.deepEqual(tables.pages, source.protocol.supplementary_pages);
  assert.equal(tables.pages.length, 4);
  const person = detail.participants.find(row => row.bib === '203');
  assert.equal(person.name, 'Jiahn Im');
  assert.equal(person.source_name, 'Jiahn Im*');
  const search = await (await h.request('skaters?q=Jiahn%20Im', 'GET')).json();
  assert.deepEqual(search.skaters.map(row => row.id), [person.id]);
  const evidence = await (await h.request('sources/[id]', 'GET', undefined, false, detail.competition.source_id)).json();
  assert.equal(evidence.roster.observations.find(row => row.bib === '203').raw_name, 'Jiahn Im*');
 } finally { h.close(); }
});

test('Land of Lincoln preserves the printed race numbers in both reports without merging races or skaters', async () => {
 const source = JSON.parse(readFileSync(new URL('../../data/samples/st-land-of-lincoln-2026-protocol.json', import.meta.url)));
 delete source.source.objectKey;
 const candidate = {...payload(), item: source};
 const h = harness();
 try {
  const {validate} = h.load(new URL('../lib/imports/validation.ts', import.meta.url).pathname);
  const altered = structuredClone(candidate);
  const extra = altered.item.evidence.events.find(event => event.event_label_raw === "500 Qualifier 1's 500 Finals Event #1");
  extra.heats[0].race_id = '102';
  assert.ok(validate(altered).report.errors.some(issue => issue.code === 'REVIEWED_RACE_SCOPE'));
  const omitted = structuredClone(candidate);
  omitted.item.protocol.empty_roster_pages = [];
  assert.ok(validate(omitted).report.errors.some(issue => issue.code === 'EMPTY_ROSTER_SOURCE'));

  const submitted = await h.request('imports', 'POST', candidate);
  const batch = await submitted.json();
  assert.equal(submitted.status, 200, JSON.stringify(batch.report.errors?.slice(0, 3)));
  h.objects.set('test-only-land-of-lincoln-archive', '%PDF-Test-only');
  h.sqlite.prepare('INSERT INTO source_documents VALUES (?,?,?,?,?)').run(source.source.sha256, source.source.url, 'test-only-land-of-lincoln-archive', 14, '2026-11-05T00:00:00Z');
  assert.equal((await h.request('imports/[id]/publish', 'POST', undefined, true, batch.id)).status, 200);

  const id = source.competition.id;
  const detail = await (await h.request('competitions/[id]', 'GET', undefined, false, id)).json();
  assert.equal(detail.results.length, 810);
  assert.equal(detail.participants.length, 116);
  assert.equal(detail.entries.length, 131);
  assert.ok(detail.results.every(row => row.scope_status === 'source-mapped'));
  assert.equal(detail.results.filter(row => row.source_page === 177).length, 15);
  for (const number of ['101', '201', '301']) {
   const races = h.sqlite.prepare('SELECT id,source_race_id,source_page FROM races WHERE competition_id=? AND source_race_id=? ORDER BY source_page').all(id,number);
   assert.deepEqual(races.map(race => race.id), [`${id}:${number}`,`${id}:500-extra-${number}`]);
   assert.ok(races.every(race => race.source_race_id === number));
   assert.equal(races[1].source_page, 177);
  }
 } finally { h.close(); }
});

test('reviewed Winter SPEEDtacular scan preserves blank clubs and every official table', async () => {
  const source = JSON.parse(readFileSync(new URL('../../data/samples/st-winter-speedtacular-2025-protocol.json', import.meta.url)));
  delete source.source.objectKey;
  const candidate = {...payload(), item: source};
  const h = harness();
  try {
    const {validate} = h.load(new URL('../lib/imports/validation.ts', import.meta.url).pathname);
    const altered = structuredClone(candidate);
    altered.item.protocol.classifications[0].text_raw = altered.item.protocol.classifications[0].text_raw.replace('18500', '18501');
    assert.ok(validate(altered).report.errors.some(issue => issue.code === 'SCANNED_SOURCE_REVIEW'));

    const response = await h.request('imports', 'POST', candidate);
    const batch = await response.json();
    assert.equal(response.status, 200, JSON.stringify(batch.report.errors));
    h.objects.set('test-only-winter-archive', '%PDF-Test-only');
    h.sqlite.prepare('INSERT INTO source_documents VALUES (?,?,?,?,?)').run(source.source.sha256, source.source.url, 'test-only-winter-archive', 14, '2026-11-06T00:00:00Z');
    assert.equal((await h.request('imports/[id]/publish', 'POST', undefined, true, batch.id)).status, 200);

    const id = source.competition.id;
    const detail = await (await h.request('competitions/[id]', 'GET', undefined, false, id)).json();
    assert.equal(detail.results.length, 102);
    assert.ok(detail.results.every(row => row.scope_status === 'source-mapped'));
    assert.equal(detail.participants.find(person => person.bib === '53').affiliation, '');
    assert.equal(detail.results.find(row => row.race_id === '1601' && row.participant_id === id + ':53').time_raw, '1:24.110');
    const classifications = await (await h.request('competitions/[id]/classifications', 'GET', undefined, false, id)).json();
    assert.equal(classifications.pages.length, 32);
    assert.equal(classifications.pages.flatMap(page => page.rows).length, 168);
  } finally {
    h.close();
  }
});
