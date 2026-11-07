import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {harness} from './support.mjs';
const item=JSON.parse(readFileSync(new URL('../../data/samples/st-buffalo-2027-protocol.json',import.meta.url)));
const payload=()=>({schemaVersion:3,coverage:'selected-events',baseBatchId:null,review:{reviewer:'Test source review',seasonSourceLabel:'2026-2027',notes:'Complete official source; user-confirmed six distinct skaters under three reused bibs.',confirmed:true},item:structuredClone(item)});

test('Buffalo publishes six distinct skaters under reused bibs and preserves every source occurrence and missing-time row',async()=>{
 const h=harness();try{
  const response=await h.request('imports','POST',payload()),batch=await response.json();assert.equal(response.status,200,JSON.stringify(batch.report.errors));
  h.objects.set('test-only-buffalo-archive','%PDF-Test-only');h.sqlite.prepare('INSERT INTO source_documents VALUES (?,?,?,?,?)').run(item.source.sha256,item.source.url,'test-only-buffalo-archive',14,'2026-11-05T00:00:00Z');
  assert.equal((await h.request('imports/[id]/publish','POST',undefined,true,batch.id)).status,200);
  const detail=await(await h.request('competitions/[id]','GET',undefined,false,item.competition.id)).json();assert.equal(detail.results.length,1319);assert.equal(detail.participants.length,191);assert.equal(detail.events.length,84);
  for(const [bib,names] of [['43',['CHEN Daniel','SUN Sean']],['44',['CHEN Ellie','POMETUN Max']],['65',['DAVIDOFF Hannah','MONTES Frida']]]){
   const people=detail.participants.filter(p=>p.bib===bib);assert.equal(people.length,2);assert.deepEqual(people.map(p=>p.name).sort(),names.sort());assert.notEqual(people[0].id,people[1].id);
   for(const p of people)assert.ok(detail.results.filter(r=>r.participant_id===p.id).every(r=>r.source_name_raw===p.name));
  }
  const repeated=detail.events.filter(e=>e.label==='DIVISION 1 HL Women A HEATS 500 m');assert.equal(repeated.length,2);assert.notEqual(repeated[0].id,repeated[1].id);
  assert.deepEqual(detail.events.map(e=>[e.label,e.source_event_number]),item.evidence.events.map(e=>[e.event_label_raw,e.event_number]));
  assert.deepEqual(detail.events.slice(0,5).map(e=>e.source_event_number),['RACE: 1','RACE: 38','RACE: 75','RACE: 112','RACE: 149']);
  const first=detail.results.filter(r=>r.event_key===detail.events[0].id);assert.deepEqual([...new Set(first.map(r=>r.race_id))],['race1','race2','race3']);
  const missing=detail.results.filter(r=>JSON.parse(r.source_fields_json).Time==='NO TIME');assert.equal(missing.length,6);assert.ok(missing.every(r=>r.time_raw===null&&r.time_microseconds===null&&r.result_status===null));
  const unplaced=missing.find(r=>r.source_name_raw==='CHEN Ting');assert.equal(unplaced.rank,null);assert.equal(unplaced.qualification,'finished');assert.equal(unplaced.points_raw,'5.36');
  const {officialTime,officialStatus}=h.load(new URL('../lib/official-result.ts',import.meta.url).pathname);assert.equal(officialTime(unplaced),'NO TIME');assert.equal(officialStatus(detail.results.find(r=>r.result_status==='PEN')),'- penalty');
  for(const person of item.participants){
   const rows=item.results.filter(r=>r.participantId===person.id),valid=rows.filter(r=>r.distanceUnit==='metres'&&r.status===null&&r.timeMicroseconds>0);
   const pb=await(await h.request('participants/[id]/personal-bests','GET',undefined,false,person.id)).json();assert.equal(pb.coverage.recorded_result_count,rows.length);assert.equal(pb.coverage.comparable_result_count,valid.length);assert.equal(pb.personalBests.length,new Set(valid.map(r=>r.distance)).size);
   for(const best of pb.personalBests){const candidates=valid.filter(r=>r.distance===best.distance),minimum=Math.min(...candidates.map(r=>r.timeMicroseconds));assert.equal(best.time_microseconds,minimum);assert.deepEqual(best.performances.map(r=>r.id).sort(),candidates.filter(r=>r.timeMicroseconds===minimum).map(r=>r.id).sort());}
   assert.ok(pb.personalBests.every(b=>![4,7].includes(b.distance)));
  }
  for(const [distance,count] of [[4,28],[7,15]]){const lap=await(await h.request('competitions/[id]?distance=laps%3A'+distance,'GET',undefined,false,item.competition.id)).json();assert.equal(lap.results.length,count);assert.ok(lap.results.every(r=>r.distance_unit==='laps'));}
  assert.equal((await h.request('imports/[id]/publish','POST',undefined,true,batch.id)).status,200);assert.equal(h.sqlite.prepare('SELECT COUNT(*) n FROM results').get().n,1319);
  const tables=await(await h.request('competitions/[id]/source-tables','GET',undefined,false,item.competition.id)).json();assert.equal(tables.pages.length,1);assert.equal(tables.pages[0].page,52);
  const classes=await(await h.request('competitions/[id]/classifications','GET',undefined,false,item.competition.id)).json();assert.equal(classes.pages.length,29);
 }finally{h.close();}
});

test('review proof rejects cross-person binding, merged repeated events and altered source values',()=>{
 const h=harness();try{const {validate}=h.load(new URL('../lib/imports/validation.ts',import.meta.url).pathname);
  for(const change of [p=>p.item.results.find(r=>r.participantId.endsWith(':d4-43')).participantId='st-buffalo-2027:d3-43',p=>p.item.participants.find(p=>p.id.endsWith(':d5-65')).bib='999',p=>p.item.evidence.events[2].event_number=p.item.evidence.events[4].event_number,p=>p.item.protocol.classifications.pop(),p=>p.item.protocol.supplementary_pages.pop(),p=>p.item.results.find(r=>r.distanceUnit==='laps').distanceUnit='metres',p=>p.item.results.find(r=>r.sourceFields.Time==='NO TIME').timeMicroseconds=1,p=>p.item.protocol.parser_version='tempus-protocol-batch/0.3']){const p=payload();change(p);assert.equal(validate(p).report.valid,false);}
 }finally{h.close();}
});
