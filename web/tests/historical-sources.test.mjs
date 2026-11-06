import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {harness} from './support.mjs';
const sample=JSON.parse(readFileSync(new URL('../../data/samples/masa-2026-selected-events.json',import.meta.url)));
const payload=()=>({schemaVersion:3,coverage:'selected-events',baseBatchId:null,review:{reviewer:'Test',seasonSourceLabel:'2025-2026',notes:'Original MASA extraction cases',confirmed:true},item:structuredClone(sample)});

test('MASA repeat-distance and super-final headings preserve exact source isolation and mixed divisions',async()=>{
 const h=harness();try{
  const p=payload(),response=await h.request('imports','POST',p),batch=await response.json();
  assert.equal(response.status,200,JSON.stringify(batch.report));
  assert.equal(batch.report.valid,true);
  assert.equal((await h.request('imports/[id]/publish','POST',undefined,true,batch.id)).status,200);
  assert.equal((await h.request('imports','POST',p)).status,200);
  const detail=await(await h.request('competitions/[id]','GET',undefined,false,'st-masa-2026')).json();
  assert.equal(detail.results.length,32);
  assert.equal(detail.events.length,3);
  assert.ok(detail.events.some(e=>e.round==='Super Final Finals'&&e.heat_count===2));
  assert.ok(detail.events.some(e=>e.label.includes('500 (#2)')&&e.distance===500&&e.heat_count===3));
  for(const r of detail.results){const d=sample.dimensions.results.find(d=>d.id===r.id);assert.equal(r.entry_id,d.entryId);assert.equal(r.division_key,d.division);assert.equal(r.gender,d.gender);}
  assert.equal(detail.events.find(e=>e.division_key==='Santos').gender,'Mixed');
  assert.ok(sample.entries.every(e=>e.ageStatus===null));
 }finally{h.close();}
});

test('new source grammar does not accept unsupported repeats, missing final tiers or forged dimensions',async()=>{
 const h=harness();try{
  // Use the protected API so schema, evidence and publication checks stay together.
  for(const mutate of [p=>{p.item.evidence.events[1].event_label_raw=p.item.evidence.events[1].event_label_raw.replace('(#2)','(#3)');},
   p=>{p.item.evidence.events[2].heats[0].label='C Final Race #3301';},
   p=>{p.item.dimensions.results[0].entryId=p.item.entries.at(-1).id;},
   p=>{p.item.source.sha256='a'.repeat(64);}]){
    const p=payload();mutate(p);assert.equal((await h.request('imports','POST',p)).status,422);
  }
 }finally{h.close();}
});

test('empty roster evidence is accepted only for the pinned MASA page and literal text',()=>{
 const h=harness();try{
  const {validate}=h.load(new URL('../lib/imports/validation.ts',import.meta.url).pathname);
  const p=payload();p.item.protocol={parser_version:'tempus-protocol-batch/0.2',sha256:sample.source.sha256,
   scanned_pages:Array.from({length:72},(_,i)=>i+1),event_labels:sample.evidence.events.map(e=>e.event_label_raw),
   roster_verification:{pages:[3,4,5],observation_count:84,exact_rows:true},classification_pages:[],complete_results:true,result_count:32,classifications:[],issues:[],
   empty_roster_pages:[{page:5,text_raw:'2026MASTC NEST5\nSKATER LIST\nTempus Competition Software Printed on Saturday at 4:25 PM\nPage 3 of 70'}]};
  assert.equal(validate(p).report.valid,true,'in-memory manifest contract fixture');
  for(const mutate of [p=>p.item.protocol.empty_roster_pages[0].text_raw+='\n77 Omitted Skater',
    p=>p.item.protocol.empty_roster_pages[0].page=6,p=>p.item.protocol.parser_version='tempus-protocol-batch/0.1',
    p=>delete p.item.protocol.empty_roster_pages,
    p=>{delete p.item.protocol.empty_roster_pages;p.item.protocol.roster_verification.pages=[3,4];},
    p=>{p.item.evidence.roster.observations[0].page=5;}]){
   const bad=structuredClone(p);mutate(bad);assert.equal(validate(bad).report.valid,false);
  }
 }finally{h.close();}
});
