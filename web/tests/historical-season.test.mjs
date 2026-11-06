import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {harness} from './support.mjs';
const item=JSON.parse(readFileSync(new URL('../../data/samples/long-track-agn-2025-protocol.json',import.meta.url)));
const payload=()=>({schemaVersion:3,coverage:'selected-events',baseBatchId:null,review:{reviewer:'Test reviewer',seasonSourceLabel:'2024-2025',notes:'Historical protocol and supplemental source tables.',confirmed:true},item:structuredClone(item)});

test('complete 2025 protocol retains every individual row, wrapped title and supplemental source page',async()=>{
 const h=harness();try{
  const response=await h.request('imports','POST',payload()),batch=await response.json();
  assert.equal(response.status,200,JSON.stringify(batch.report));assert.equal(batch.report.valid,true);assert.equal(batch.report.counts.results,509);assert.equal(batch.report.counts.events,67);
  // In-memory publication fixture only. Binary-hash archival has separate endpoint tests.
  const archive='test-only-reviewed-pdf';h.objects.set(archive,'%PDF-1.7\nTest-only archive placeholder');
  h.sqlite.prepare('INSERT INTO source_documents VALUES (?,?,?,?,?)').run(item.source.sha256,item.source.url,archive,41,'2026-11-04T00:00:00Z');
  assert.equal((await h.request('imports/[id]/publish','POST',undefined,true,batch.id)).status,200);
  const detail=await(await h.request('competitions/[id]','GET',undefined,false,'lt-agn-2025')).json();
  assert.equal(detail.results.length,509);assert.equal(detail.events.length,67);assert.equal(detail.entries.length,79);assert.equal(detail.supplementarySourcePages,2);
  assert.ok(detail.results.every(r=>r.scope_status==='source-mapped'&&r.entry_id));
  const tablesResponse=await h.request('competitions/[id]/source-tables?source='+detail.competition.source_id,'GET',undefined,false,'lt-agn-2025');
  const tables=await tablesResponse.json();assert.equal(tablesResponse.headers.get('Cache-Control'),'no-store');assert.deepEqual(tables.pages,item.protocol.supplementary_pages);
  assert.equal((await h.request('competitions/[id]/source-tables?source='+ 'a'.repeat(16),'GET',undefined,false,'lt-agn-2025')).status,409);
  assert.equal((await h.request('competitions/[id]/source-tables?source=bad','GET',undefined,false,'lt-agn-2025')).status,400);
  const pb=await(await h.request('participants/[id]/personal-bests','GET',undefined,false,'lt-agn-2025:438')).json();
  assert.equal(pb.coverage.recorded_result_count,5);assert.ok(pb.personalBests.every(b=>b.performances.every(r=>r.source_page<124)));
  assert.equal((await h.request('imports/[id]/publish','POST',undefined,true,batch.id)).status,200);
  assert.equal(h.sqlite.prepare('SELECT COUNT(*) n FROM results').get().n,509);
 }finally{h.close();}
});

test('historical proof rejects dropped/changed tables, fabricated heading continuations and altered entry links',()=>{
 const h=harness();try{
  const {validate}=h.load(new URL('../lib/imports/validation.ts',import.meta.url).pathname);
  const wrapped=p=>p.item.evidence.events.find(e=>e.source_heading_lines?.[1]==='Final Finals');
  for(const mutate of [p=>delete p.item.protocol.supplementary_pages,p=>p.item.protocol.supplementary_pages.pop(),
    p=>p.item.protocol.supplementary_pages[0].text_raw+='\nInvented row',p=>p.item.protocol.supplementary_pages[0].page=123,
    p=>p.item.source.sha256='a'.repeat(64),p=>delete wrapped(p).source_heading_lines,
    p=>wrapped(p).source_heading_lines[1]='Finals',p=>p.item.dimensions.results[0].entryId=p.item.entries.at(-1).id]){
   const p=payload();mutate(p);assert.equal(validate(p).report.valid,false);
  }
 }finally{h.close();}
});
