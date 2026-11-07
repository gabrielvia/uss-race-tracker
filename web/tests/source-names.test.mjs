import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {harness} from './support.mjs';
const source=JSON.parse(readFileSync(new URL('../../data/samples/masa-agn-name-review-cases.json',import.meta.url)));
const review=JSON.parse(readFileSync(new URL('../../data/sources/masa-agn-identity-review.json',import.meta.url)));
async function ready(){
 const h=harness();
 for(const item of structuredClone(source.competitions)){
  const response=await h.request('imports','POST',{schemaVersion:3,coverage:'selected-events',baseBatchId:null,review:{reviewer:'Test',seasonSourceLabel:'2025-2026',notes:'Real source name cases',confirmed:true},item});
  const batch=await response.json();assert.equal(response.status,200,JSON.stringify(batch.report));
  assert.equal((await h.request('imports/[id]/publish','POST',undefined,true,batch.id)).status,200);
 }
 return h;
}
const search=(h,q)=>h.request('skaters?q='+encodeURIComponent(q),'GET',undefined,false).then(r=>r.json());
const profile=(h,id)=>h.request('participants/[id]/profile','GET',undefined,false,id).then(r=>r.json());

test('MASA stars are display/search annotations with original source names and punctuation retained',async()=>{
 const h=await ready();try{
  const data=await search(h,'Lindsay Lin');assert.equal(data.total,1,'the reviewed star and club label correspondences allow linking');
  assert.ok(data.skaters.every(s=>s.name==='Lindsay Lin'));
  const p=await profile(h,'st-masa-2026:78');assert.equal(p.participant.name,'Lindsay Lin');assert.equal(p.participant.source_name,'Lindsay* Lin');
  assert.ok(p.aliases.some(a=>a.raw_name==='Lindsay* Lin'));
  assert.equal((await search(h,'Xinyu (Lilian) Li')).total,1);
  const detail=await(await h.request('competitions/[id]','GET',undefined,false,'st-masa-2026')).json();
  assert.equal(detail.participants.find(p=>p.id==='st-masa-2026:78').name,'Lindsay Lin');
  assert.ok(detail.entries.some(e=>e.raw_name==='Lindsay* Lin'));
  assert.equal(h.sqlite.prepare('SELECT name FROM participants WHERE id=?').get('st-masa-2026:78').name,'Lindsay* Lin');
  const {sourceNameSql}=h.load(new URL('../lib/source-name.ts',import.meta.url).pathname);
  assert.equal(h.sqlite.prepare('SELECT '+sourceNameSql("'A* B'","'other-source'")+ ' name').get().name,'A* B');
 }finally{h.close();}
});

test('explicit reviewed MASA/AGN pairs share search, PB, history and chart identity without changing source rows',async()=>{
 const h=await ready();try{
  const before=h.snapshot();
  const automatic=h.sqlite.prepare("SELECT COUNT(*) n FROM identity_decisions WHERE reviewer='Automatic identity rule v2'").get().n;
  assert.equal(automatic,64);
  for(const pair of review.pairs){
   const target=(await h.request('identity?participant='+encodeURIComponent(pair.targetParticipantKey),'GET')).json();
   const targetId=(await target).link.skater_id;
   for(const id of [pair.targetParticipantKey,pair.participantKey]){
    const current=await(await h.request('identity?participant='+encodeURIComponent(id),'GET')).json();
    const d={participantKey:id,expectedRevision:current.link.revision,expectedBatchId:current.link.batch_id,skaterId:targetId,reviewer:'Test reviewed source pairs',reason:review.basis,evidence:[review.sourceUrl,review.targetUrl]};
    assert.equal((await h.request('identity','POST',d)).status,200);
    assert.equal((await h.request('identity','POST',d)).status,200);
   }
   const result=await search(h,pair.displayName);assert.equal(result.total,1,pair.displayName);assert.equal(result.skaters[0].competition_count,2);assert.equal(result.skaters[0].identity_status,'reviewed');
  }
  assert.deepEqual(h.snapshot(),before,'original names, entries, results and sources remain intact');
  const a='st-agn-2026:185',b='st-masa-2026:78';
  assert.equal((await profile(h,a)).participant.skater_id,(await profile(h,b)).participant.skater_id);
  for(const id of [a,b]){
   const pb=await(await h.request('participants/[id]/personal-bests','GET',undefined,false,id)).json();assert.equal(pb.personalBests[0].time_microseconds,50640000);
   const history=await(await h.request('participants/[id]/records','GET',undefined,false,id)).json();assert.equal(history.total,2);assert.equal(new Set(history.results.map(r=>r.competition_id)).size,2);assert.ok(history.results.every(r=>r.name==='Lindsay Lin'));
  }
  const data=await(await h.request('performances?'+new URLSearchParams([['participant',a],['participant',b],['discipline','short-track'],['distance','500']]),'GET',undefined,false)).json();
  assert.equal(data.series.length,1);assert.equal(data.competitionBests.length,2);assert.ok(data.records.every(r=>r.name==='Lindsay Lin'));
  assert.equal((await search(h,'Lindsay* Lin')).total,1);
  assert.equal(h.sqlite.prepare("SELECT COUNT(*) n FROM identity_decisions WHERE reviewer='Test reviewed source pairs'").get().n,64);
  h.sqlite.prepare("UPDATE skater_links SET status='needs_review' WHERE participant_key=?").run(b);
  assert.equal((await search(h,'Lindsay Lin')).total,2,'pending identity remains isolated');
 }finally{h.close();}
});
