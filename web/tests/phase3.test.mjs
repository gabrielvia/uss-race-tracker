import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { harness } from "./support.mjs";
const hash=s=>createHash("sha256").update(s).digest("hex");
const pdf=new TextEncoder().encode("%PDF-1.7\nPhase 3 archive fixture\n%%EOF");
const digest=hash(pdf),sourceUrl="https://assets.contentstack.io/phase3-fixture.pdf";
const review={reviewer:"Test operator",seasonSourceLabel:"2025-2026",notes:"Checked the complete synthetic test protocol.",confirmed:true};
function candidate({id="phase3-test",season="2025-2026",people=2,events=1,category="JR C",club="Test Club",name="Test Skater",sharedName=false,protocol=true}={}){
 const roster={parser_version:"tempus-roster-sample/0.1",source_id:"a".repeat(16),source_url:sourceUrl,sha256:digest,page_count:3,observation_count:people,distinct_bib_count:people,issues:[],observations:[]};
 const participants=[],entries=[],results=[],selected=[];
 for(let n=1;n<=people;n++){
  const personName=sharedName?name:`${name} ${n}`;
  roster.observations.push({bib:String(n),name:personName,raw_name:personName,affiliation_raw:club,division_raw:"Junior C Women",age_status_raw:category,page:1});
  participants.push({id:`${id}:${n}`,bib:String(n),name:personName,affiliation:club});
  entries.push({id:`${id}:${n}:${n-1}`,participantId:`${id}:${n}`,division:"Junior C Women",ageStatus:category,rawName:personName,sourcePage:1});
 }
 for(let e=1;e<=events;e++){
  const label=`Junior C Women's 500 Finals Event #${e}`,race=String(e*100+1),raw=[];
  for(let n=1;n<=people;n++){
   const personName=participants[n-1].name;
   const r={rank:n,status_raw:null,row_raw:`${n} ${n} ${personName} ${club} 0:55.000`,bib:String(n),name_raw:personName,affiliation_raw:club,time_raw:"0:55.000",time_microseconds:55_000_000,qualification_raw:null,event_label_raw:label,event_number:String(e),distance_metres:500,round_raw:"Finals",race_id:race,race_label_raw:`A Final Race #${race}`,source_page:2,group_label:"Junior C Women's",heat_number:null,heat_total:null};raw.push(r);
   results.push({id:`${id}:${race}:${n}`,participantId:`${id}:${n}`,raceId:race,distance:500,round:"Finals",rank:n,status:null,timeRaw:r.time_raw,timeMicroseconds:r.time_microseconds,qualification:null,sourcePage:2,eventKey:hash(`${id}|${label}`).slice(0,20),eventLabel:label,raceLabel:r.race_label_raw,heatNumber:null,heatTotal:null});
  }
  selected.push({parser_version:"tempus-complete-event/0.4",status:"complete_selected_event",source_id:roster.source_id,source_url:sourceUrl,sha256:digest,pages:[2],event_number:String(e),event_label_raw:label,heat_count:1,result_count:raw.length,heats:[{race_id:race,label:`A Final Race #${race}`,heat_number:null,heat_total:null,result_count:raw.length}],results:raw});
 }
 const item={competition:{id,title:"Phase 3 Test Competition",discipline:"short-track",season,startsOn:`${season.slice(5)}-02-01`,endsOn:`${season.slice(5)}-02-02`,location:"Test Rink"},source:{id:roster.source_id,url:sourceUrl,sha256:digest},participants,entries,results,evidence:{roster,events:selected}};
 if(protocol){const text=`Junior C Women\nOVERALL CLASSIFICATION\n0 1 ${participants[0].name} ${club} 0`;item.protocol={parser_version:"tempus-protocol-batch/0.1",sha256:digest,scanned_pages:[1,2,3],event_labels:selected.map(e=>e.event_label_raw),roster_verification:{pages:[1],observation_count:people,exact_rows:true},classification_pages:[3],complete_results:true,result_count:results.length,classifications:[{page:3,kind:"overall",label:"Junior C Women / OVERALL CLASSIFICATION",text_raw:text,rows:[{rank:0,bib:"1",row_raw:text.split("\n").at(-1)}]}],issues:[]};}
 return {schemaVersion:3,coverage:"selected-events",baseBatchId:null,review:{...review,seasonSourceLabel:season},item};
}
async function archive(h,{authorized=true,bytes=pdf,id=digest,length}={}){
 const fn=h.load(new URL("../app/api/imports/documents/[id]/route.ts",import.meta.url).pathname).POST;
 return fn(new Request("https://example.test/api/imports/documents/"+id,{method:"POST",headers:{"Content-Type":"application/pdf","X-Source-URL":sourceUrl,...(length===undefined?{}:{"Content-Length":String(length)}),...(authorized?{Authorization:"Bearer test-only-seed-token"}:{})},body:bytes}),{params:Promise.resolve({id})});
}
async function submit(h,p){const response=await h.request("imports","POST",p);return {response,batch:await response.json()};}
const publish=(h,id)=>h.request("imports/[id]/publish","POST",undefined,true,id);
async function active(h,p){const {response,batch}=await submit(h,p);assert.equal(response.status,200,JSON.stringify(batch.report));assert.equal((await publish(h,batch.id)).status,200);return batch;}
const profile=(h,key)=>h.request("participants/[id]/profile","GET",undefined,false,key).then(r=>r.json());
const tables=["participants","results","races","competition_events","skaters","skater_links","skater_aliases","skater_observations","publication_revisions","classification_pages","import_publications"];
const snapshot=h=>Object.fromEntries(tables.map(t=>[t,h.sqlite.prepare(`SELECT * FROM ${t} ORDER BY 1`).all()]));
function rule(season="2025-2026",bounds={min:13,max:14}){return {label:"Test reviewed age rule",version:"test/1",discipline:"short-track",season,baselineDate:season.slice(0,4)+"-07-01",basis:"before-july-1",source:{url:sourceUrl,sha256:digest,pages:[1]},categories:{"JR C":bounds},rangeAnnotations:false};}
async function assignRule(h,p,batch,bounds){return h.request("age-rules","POST",{competitionId:p.item.competition.id,expectedBatchId:batch.id,expectedRevision:null,definition:rule(p.item.competition.season,bounds),reviewer:"Test operator",reason:"Reviewed source rule and baseline."});}

test("original PDF archival is authenticated, hash-checked and idempotent",async()=>{
 const h=harness();try{
  assert.equal((await archive(h,{authorized:false})).status,401);assert.equal(h.state.writes,0);
  assert.equal((await archive(h,{bytes:new TextEncoder().encode("wrong")})).status,400);assert.equal(h.state.writes,0);
  assert.equal((await archive(h)).status,200);assert.equal((await archive(h)).status,200);
  assert.equal(h.sqlite.prepare("SELECT count(*) n FROM source_documents").get().n,1);
  assert.equal((await h.request("documents/[id]","GET",undefined,false,digest)).status,404);
  const p=candidate();await active(h,p);
  const response=await h.request("documents/[id]","GET",undefined,false,digest);
  assert.equal(response.status,200);assert.equal(hash(new Uint8Array(await response.arrayBuffer())),digest);
 }finally{h.close();}
});

test("large original PDFs require a matching declared length and retain their bytes", async () => {
 const h=harness();
 try {
  const bytes=new Uint8Array(33*1024*1024);
  bytes.set(pdf);
  const id=hash(bytes);
  assert.equal((await archive(h,{bytes,id})).status,413);
  assert.equal((await archive(h,{bytes:pdf,length:pdf.length+1})).status,400);
  assert.equal((await archive(h,{bytes,id,length:bytes.length})).status,200);
  assert.equal(h.sqlite.prepare("SELECT byte_length FROM source_documents WHERE sha256=?").get(id).byte_length,bytes.length);
  assert.equal(hash(h.objects.get(`documents/${id}.pdf`)),id);
 } finally { h.close(); }
});

test("a full-name and club match links records across seasons without an age rule", async () => {
 const h=harness();
 try {
  await archive(h);
  const first=candidate({id:"alpha-meet",season:"2024-2025",people:1,club:"Garden State Speedskating"});
  const second=candidate({id:"beta-meet",people:1,club:"Garden State"});
  const third=candidate({id:"third-meet",people:1,club:"Garden State"});
  const distinct=candidate({id:"club-mismatch",people:1,club:"Other Club"});
  const nameMismatch=candidate({id:"name-mismatch",people:1,club:"Garden State",name:"Other Skater"});
  const direct=[candidate({id:"direct-one",people:1,club:"Direct"}),candidate({id:"direct-two",people:1,club:"Direct"})];
  const firstBatch=await active(h,first);
  assert.equal((await assignRule(h,first,firstBatch,{min:12,max:12})).status,200);
  const secondBatch=await active(h,second);
  assert.equal((await assignRule(h,second,secondBatch,{min:14,max:14})).status,200);
  for(const p of [third,distinct,nameMismatch,...direct]) await active(h,p);
  const profiles=await Promise.all([first,second,third,distinct,nameMismatch,...direct].map(p=>profile(h,p.item.participants[0].id)));
  const [a,b,c,d,e,f,g]=profiles;
  assert.equal(a.participant.skater_id,b.participant.skater_id);
  assert.equal(a.participant.skater_id,c.participant.skater_id);
  assert.equal(a.identityStatus,"reviewed");
  assert.equal(c.observations.length,3);
  assert.equal(c.age.status,"conflict");
  assert.notEqual(a.participant.skater_id,d.participant.skater_id);
  assert.notEqual(a.participant.skater_id,e.participant.skater_id);
  assert.notEqual(f.participant.skater_id,g.participant.skater_id);
  const decisions=h.sqlite.prepare("SELECT reason,evidence_json FROM identity_decisions WHERE reviewer='Automatic identity rule v2'").all();
  assert.equal(decisions.length,3);
  assert.ok(decisions.every(d=>d.reason.includes("garden state")&&JSON.parse(d.evidence_json)[0].endsWith("#page=1")));
 } finally { h.close(); }
});

test("identity reconciliation preserves duplicate entries and a reviewed split", async () => {
 const h=harness();
 try {
  await archive(h);
  const duplicate=candidate({id:"duplicate-meet",people:2,sharedName:true,name:"Shared Name"});
  const other=candidate({id:"other-meet",people:1,sharedName:true,name:"Shared Name"});
  const first=candidate({id:"split-first",people:1});
  const second=candidate({id:"split-second",people:1});
  for(const p of [duplicate,other,first,second]) await active(h,p);
  const ids=await Promise.all([...duplicate.item.participants,...other.item.participants].map(p=>profile(h,p.id).then(x=>x.participant.skater_id)));
  assert.equal(new Set(ids).size,3);
  const key=second.item.participants[0].id;
  const route="identity/reconcile?competition=split-second";
  const linkResponse=await h.request("identity?participant="+key,"GET");
  const {link}=await linkResponse.json();
  const split=await h.request("identity","POST",{participantKey:key,expectedRevision:link.revision,expectedBatchId:link.batch_id,skaterId:null,reviewer:"Test operator",reason:"These entries belong to different skaters.",evidence:[sourceUrl]});
  assert.equal(split.status,200);
  assert.equal((await h.request(route,"POST",undefined,false)).status,401);
  const repeat=await h.request(route,"POST");
  assert.equal(repeat.status,200);
  assert.equal((await repeat.json()).decisions,0);
  assert.notEqual((await profile(h,key)).participant.skater_id,(await profile(h,first.item.participants[0].id)).participant.skater_id);
 } finally { h.close(); }
});

test("protected reconciliation backfills a published competition idempotently", async () => {
 const h=harness();
 try {
  await archive(h);
  const first=candidate({id:"older-identity",people:1});
  const second=candidate({id:"published-identity",people:1});
  for(const p of [first,second]) await active(h,p);
  // Recreate the separate links left by an earlier version of the matcher.
  h.sqlite.exec("DELETE FROM identity_decisions");
  for(const p of [first,second]) {
   const key=p.item.participants[0].id;
   h.sqlite.prepare("UPDATE skater_links SET skater_id=?,status='competition-local',revision=(SELECT batch_id FROM import_publications WHERE competition_id=?) WHERE participant_key=?")
    .run(hash(`competition-skater|${key}`).slice(0,20),p.item.competition.id,key);
  }
  const route="identity/reconcile?competition=published-identity";
  const before=h.snapshot();
  const applied=await h.request(route,"POST");
  assert.equal(applied.status,200);
  assert.equal((await applied.json()).decisions,2);
  assert.equal((await (await h.request(route,"POST")).json()).decisions,0);
  assert.deepEqual(h.snapshot(),before);
 } finally { h.close(); }
});

test("full protocols require the archived source and publish over 1000 rows atomically with bounded SQL",async()=>{
 const h=harness();try{
  const p=candidate({people:10,events:120});const {response,batch}=await submit(h,p);
  assert.equal(response.status,200,JSON.stringify(batch.report));assert.equal(batch.report.coverage,"protocol-results");assert.ok(batch.report.warnings.some(w=>w.code==="PROTOCOL_RESULTS_COVERAGE"));assert.equal((await publish(h,batch.id)).status,409);
  await archive(h);const before=h.state.executed;
  assert.equal((await publish(h,batch.id)).status,200);
  assert.ok(h.state.executed-before<100,"Bulk publication must not execute one statement per result");
  assert.equal(h.snapshot().results.length,1200);assert.equal(h.sqlite.prepare("SELECT count(*) n FROM races").get().n,120);
  const old=snapshot(h);assert.equal((await publish(h,batch.id)).status,200);assert.deepEqual(snapshot(h),old);
  const detail=await (await h.request("competitions/[id]","GET",undefined,false,p.item.competition.id)).json();
  assert.equal(detail.coverage.kind,"protocol-results");assert.equal(detail.coverage.completeCompetition,false);assert.ok(detail.archivedPdf);
  const classes=await (await h.request("competitions/[id]/classifications","GET",undefined,false,p.item.competition.id)).json();assert.equal(classes.pages[0].rows[0].rank,0);
  assert.equal(h.snapshot().results.length,1200,"Classifications must not duplicate result counts");
  const broken=structuredClone(p);broken.baseBatchId=batch.id;broken.item.protocol.event_labels.pop();
  const rejected=await submit(h,broken);assert.equal(rejected.response.status,422);assert.ok(rejected.batch.report.errors.some(e=>e.code==="PROTOCOL_COVERAGE"));
  assert.equal((await publish(h,rejected.batch.id)).status,409);assert.deepEqual(snapshot(h),old);
 }finally{h.close();}
});

test("late bulk failure preserves projection, lineage, aliases, observations and identity links",async()=>{
 const h=harness();try{
  await archive(h);const p=candidate({people:50,events:24}),a=await active(h,p),before=snapshot(h);
  const next=structuredClone(p);next.baseBatchId=a.id;next.item.competition.location="Corrected rink";
  const b=(await submit(h,next)).batch;h.state.failSql=s=>s.sql.startsWith("INSERT INTO publication_revisions");
  assert.equal((await publish(h,b.id)).status,503);assert.deepEqual(snapshot(h),before);
  h.state.failSql=null;assert.equal((await publish(h,b.id)).status,200);
  const revisions=h.sqlite.prepare("SELECT * FROM publication_revisions ORDER BY published_at").all();assert.equal(revisions.length,2);assert.equal(revisions[1].previous_batch_id,a.id);assert.equal(revisions[1].season_label,"2025-2026");
  assert.equal(h.sqlite.prepare("SELECT count(*) n FROM skaters").get().n,50);
  assert.equal(h.sqlite.prepare("SELECT count(*) n FROM skater_observations").get().n,100,"Corrections must retain source observations without duplicating active people");
 }finally{h.close();}
});

test("FNT, YC and an explicit absent finish remain readable without fabricated zero times",async()=>{
 const h=harness();try{
  await archive(h);
  for(const status of ["FNT","YC",null]){
   const p=candidate({id:"finish-"+(status??"missing").toLowerCase(),protocol:false});const raw=p.item.evidence.events[0].results[0],r=p.item.results[0];
   raw.time_raw=null;raw.time_microseconds=null;raw.status_raw=status;r.timeRaw=null;r.timeMicroseconds=null;r.status=status;
   raw.row_raw=raw.row_raw.replace(" 0:55.000",status?" "+status:"");
   if(!status){raw.finish_note="Time not recorded in source.";r.finishNote=raw.finish_note;}
   await active(h,p);
   const row=h.snapshot().results.find(x=>x.id===r.id);assert.equal(row.time_microseconds,null);assert.equal(row.result_status,status);assert.equal(row.finish_note,status?null:"Time not recorded in source.");
  }
 }finally{h.close();}
});

test("identical names in different competitions stay separate until an audited identity decision",async()=>{
 const h=harness();try{
  const a=candidate({id:"identity-a",season:"2024-2025",protocol:false}),b=candidate({id:"identity-b",protocol:false,club:"Second Club"});
  const ba=await active(h,a),bb=await active(h,b);
  assert.equal((await assignRule(h,a,ba)).status,200);assert.equal((await assignRule(h,b,bb)).status,200);
  const pa=await profile(h,"identity-a:1"),pb=await profile(h,"identity-b:1");assert.notEqual(pa.participant.skater_id,pb.participant.skater_id);
  const read=await(await h.request("identity?participant=identity-b:1","GET")).json();
  const d={participantKey:"identity-b:1",expectedRevision:read.link.revision,expectedBatchId:bb.id,skaterId:pa.participant.skater_id,reviewer:"Test operator",reason:"Explicitly reviewed the two source records.",evidence:[sourceUrl]};
  assert.equal((await h.request("identity","POST",d,false)).status,401);
  const approved=await h.request("identity","POST",d);assert.equal(approved.status,200);assert.equal((await h.request("identity","POST",d)).status,200);
  const joined=await profile(h,"identity-b:1");assert.equal(joined.age.status,"inferred");assert.equal(joined.age.max,joined.age.min);assert.equal(joined.observations.filter(o=>o.raw_name==="Test Skater 1").length,2);
  assert.deepEqual(new Set(joined.observations.map(o=>o.affiliation)),new Set(["Test Club","Second Club"]));
  const stale={...d,reason:"Stale change"};assert.equal((await h.request("identity","POST",stale)).status,409);
  assert.equal(h.sqlite.prepare("SELECT count(*) n FROM identity_decisions").get().n,1);
  const current=await(await h.request("identity?participant=identity-b:1","GET")).json();
  const split={...d,expectedRevision:current.link.revision,skaterId:null,reason:"Reviewed a correction: these are different skaters."};assert.equal((await h.request("identity","POST",split)).status,200);
  const separated=await profile(h,"identity-b:1");assert.notEqual(separated.participant.skater_id,pa.participant.skater_id);assert.equal(separated.age.status,"range");
 }finally{h.close();}
});

test("contradictory age evidence becomes a conflict and unknown ability groups do not establish age",async()=>{
 const h=harness();try{
  const a=candidate({id:"age-a",protocol:false}),b=candidate({id:"age-b",protocol:false,club:"Second Club"});const ba=await active(h,a),bb=await active(h,b);
  await assignRule(h,a,ba,{min:13,max:14});await assignRule(h,b,bb,{min:25,max:26});
  const pa=await profile(h,"age-a:1"),link=await(await h.request("identity?participant=age-b:1","GET")).json();
  assert.equal((await h.request("identity","POST",{participantKey:"age-b:1",expectedRevision:link.link.revision,expectedBatchId:bb.id,skaterId:pa.participant.skater_id,reviewer:"Test operator",reason:"Source identity review",evidence:[sourceUrl]})).status,200);
  const corrected=structuredClone(b);corrected.baseBatchId=bb.id;
  const preview=await submit(h,corrected);assert.equal(preview.response.status,200);assert.ok(preview.batch.report.warnings.some(w=>w.code==="AGE_EVIDENCE_CONFLICT"));assert.equal(preview.batch.report.ageChecks.conflicts.length,1);
  const age=(await profile(h,"age-b:1")).age;assert.equal(age.status,"conflict");assert.equal(age.min,null);assert.equal(age.max,null);
  const unknown=candidate({id:"unknown-age",category:"Group A",protocol:false,club:"Other Club"});const bu=await active(h,unknown);await assignRule(h,unknown,bu);
  const u=await profile(h,"unknown-age:1");assert.equal(u.age.status,"not_available");assert.equal(u.unresolvedAgeEvidence.length,1);
 }finally{h.close();}
});

test("source identity changes require review and do not silently rewrite a skater",async()=>{
 const h=harness();try{
  const p=candidate({id:"identity-change",protocol:false}),a=await active(h,p);
  const revised=candidate({id:"identity-change",protocol:false,name:"Different Person"});revised.baseBatchId=a.id;await active(h,revised);
  const r=await profile(h,"identity-change:1");assert.equal(r.identityStatus,"needs_review");assert.equal(r.age.status,"conflict");
  assert.equal(h.sqlite.prepare("SELECT display_name FROM skaters WHERE id=?").get(r.participant.skater_id).display_name,"Test Skater 1");
 }finally{h.close();}
});

test("age rules are versioned, authorized and cannot be silently assigned to a different season",async()=>{
 const h=harness();try{
  const p=candidate({protocol:false}),b=await active(h,p);const d={competitionId:p.item.competition.id,expectedBatchId:b.id,expectedRevision:null,definition:rule(),reviewer:"Test operator",reason:"Reviewed baseline"};
  assert.equal((await h.request("age-rules","POST",d,false)).status,401);assert.equal((await h.request("age-rules","POST",d)).status,200);assert.equal((await h.request("age-rules","POST",d)).status,200);
  assert.equal((await h.request("age-rules","POST",{...d,reason:"Unreviewed overwrite"})).status,409);
  const assignment=(await(await h.request("age-rules?competition="+p.item.competition.id,"GET")).json()).assignment;
  assert.equal((await h.request("age-rules","POST",{...d,expectedRevision:assignment.revision,definition:rule("2024-2025")})).status,400);
  assert.equal(h.sqlite.prepare("SELECT count(*) n FROM age_rule_decisions").get().n,1);
 }finally{h.close();}
});

test("July 1 derivation intersects season-shifted evidence and is independent of client timezone",()=>{
 const h=harness();try{
  const {deriveSkatingAge,currentSeason}=h.load(new URL("../lib/skating-age.ts",import.meta.url).pathname);
  const e=[{season:"2024-2025",basis:"before-july-1",min:13,max:14,source:{}},{season:"2025-2026",basis:"before-july-1",min:13,max:14,source:{}}];
  const before=deriveSkatingAge(e,new Date("2026-07-01T03:59:59Z")),after=deriveSkatingAge(e,new Date("2026-07-01T04:00:00Z"));
  assert.equal(before.min,14);assert.equal(after.min,15);assert.equal(after.status,"inferred");assert.equal(after.referenceSeason,"2026-2027");assert.equal(after.nextUpdateAt,"2027-07-01T04:00:00.000Z");
  assert.equal(currentSeason(new Date("2026-01-01T12:00:00Z")),2025);
  assert.deepEqual(after,deriveSkatingAge(e,new Date("2026-06-30T21:00:00-07:00")));
  assert.equal(deriveSkatingAge([{...e[0],max:null}],new Date("2026-10-30T12:00:00Z")).status,"lower_bound");
  assert.equal(deriveSkatingAge([e[0],{...e[1],basis:"as-of-july-1"}]).status,"conflict");
 }finally{h.close();}
});

test("competition queries scope search, pagination and counts to discipline plus season",async()=>{
 const h=harness();try{
  h.sqlite.prepare("INSERT INTO sources VALUES (?,?,?,?)").run("f".repeat(16),sourceUrl,digest,"fixture");
  for(let i=0;i<29;i++)h.sqlite.prepare("INSERT INTO competitions VALUES (?,?,?,?,?,?,?,?)").run("scope-"+i,"Test competition "+i,i===27?"long-track":"short-track",i===28?"2024-2025":"2025-2026",i===28?"2025-02-01":"2026-02-01",i===28?"2025-02-02":"2026-02-02","Rink","f".repeat(16));
  const first=await(await h.request("competitions?discipline=short-track&season=2025-2026&q=Test&page=1","GET",undefined,false)).json();
  const second=await(await h.request("competitions?discipline=short-track&season=2025-2026&q=Test&page=2","GET",undefined,false)).json();
  assert.equal(first.total,27);assert.equal(first.competitions.length,25);assert.equal(second.competitions.length,2);
  assert.equal(new Set([...first.competitions,...second.competitions].map(c=>c.id)).size,27);
  assert.ok(first.competitions.every(c=>c.discipline==="short-track"&&c.season==="2025-2026"));
  assert.equal((await h.request("competitions?discipline=short-track","GET",undefined,false)).status,400);
  const empty=await(await h.request("competitions?discipline=short-track&season=2023-2024","GET",undefined,false)).json();assert.equal(empty.total,0);assert.deepEqual(empty.competitions,[]);
  const literal=await(await h.request("competitions?discipline=short-track&season=2025-2026&q=%25","GET",undefined,false)).json();assert.equal(literal.total,0);
  assert.equal((await(await h.request("competitions/scopes","GET",undefined,false)).json()).scopes.length,3);
 }finally{h.close();}
});

test("protected history includes rejected and published revisions while viewers cannot read it",async()=>{
 const h=harness();try{
  const p=candidate({protocol:false}),a=await active(h,p),bad=structuredClone(p);bad.item.competition.title="Rejected correction";bad.item.evidence.events[0].heats=[];await submit(h,bad);
  const path="imports?competition="+p.item.competition.id+"&history=1";
  assert.equal((await h.request(path,"GET",undefined,false)).status,401);
  const history=await(await h.request(path,"GET")).json();assert.equal(history.total,2);assert.deepEqual(new Set(history.batches.map(b=>b.status)),new Set(["published","rejected"]));
  assert.equal(history.batches.find(b=>b.id===a.id).season_label,"2025-2026");
 }finally{h.close();}
});

test("source event removal requires explicit reviewed keys and retains correction lineage",async()=>{
 const h=harness();try{
  const p=candidate({events:2,protocol:false}),a=await active(h,p),oldEvidence=h.publishedEvidence();
  const reduced=candidate({protocol:false});reduced.baseBatchId=a.id;
  const omitted=(await submit(h,reduced)).batch;assert.equal((await publish(h,omitted.id)).status,409);
  const removed=p.item.results.find(r=>r.eventLabel.endsWith("#2")).eventKey;
  const corrected=structuredClone(reduced);corrected.review.reconciliation={removedEventKeys:[removed],reason:"Official corrected source withdraws this duplicated event.",confirmed:true};
  const b=(await submit(h,corrected)).batch;assert.ok(b.report.warnings.some(w=>w.code==="EXPLICIT_COVERAGE_RECONCILIATION"));assert.equal((await publish(h,b.id)).status,200);
  assert.equal(h.snapshot().competition_events.length,1);assert.equal(h.snapshot().results.length,2);assert.equal((await publish(h,b.id)).status,200);
  assert.equal(h.sqlite.prepare("SELECT previous_batch_id FROM publication_revisions WHERE batch_id=?").get(b.id).previous_batch_id,a.id);
  assert.ok(oldEvidence.every(e=>[...h.objects.values()].includes(e)));
  const unknown=structuredClone(corrected);unknown.baseBatchId=b.id;unknown.review.reconciliation.removedEventKeys=["0".repeat(20)];
  const invalid=(await submit(h,unknown)).batch;assert.equal((await publish(h,invalid.id)).status,409);
  assert.equal(h.snapshot().results.length,2);
 }finally{h.close();}
});

test("concurrent identity review admits one decision and returns a stale-revision conflict",async()=>{
 const h=harness();try{
  const a=candidate({id:"race-a",protocol:false}),b=candidate({id:"race-b",protocol:false,club:"Second Club"});await active(h,a);const bb=await active(h,b);
  const target=(await profile(h,"race-a:1")).participant.skater_id,current=await(await h.request("identity?participant=race-b:1","GET")).json();
  const d={participantKey:"race-b:1",expectedRevision:current.link.revision,expectedBatchId:bb.id,skaterId:target,reviewer:"Test operator",reason:"First reviewed mapping",evidence:[sourceUrl]};
  h.state.beforeWriteBatch=async()=>{assert.equal((await h.request("identity","POST",{...d,skaterId:null,reason:"Concurrent separate-person decision"})).status,200);};
  assert.equal((await h.request("identity","POST",d)).status,409);
  assert.equal(h.sqlite.prepare("SELECT count(*) n FROM identity_decisions").get().n,1);assert.notEqual((await profile(h,"race-b:1")).participant.skater_id,target);
 }finally{h.close();}
});

test("concurrent age-rule review preserves the winning version and rejects a stale assignment",async()=>{
 const h=harness();try{
  const p=candidate({protocol:false}),b=await active(h,p),d={competitionId:p.item.competition.id,expectedBatchId:b.id,expectedRevision:null,definition:rule(),reviewer:"Test operator",reason:"First reviewed rule"};
  h.state.beforeWriteBatch=async()=>{assert.equal((await h.request("age-rules","POST",{...d,definition:rule("2025-2026",{min:15,max:16}),reason:"Concurrent reviewed correction"})).status,200);};
  assert.equal((await h.request("age-rules","POST",d)).status,409);assert.equal(h.sqlite.prepare("SELECT count(*) n FROM age_rule_decisions").get().n,1);
  const current=await(await h.request("age-rules?competition="+p.item.competition.id,"GET")).json();assert.equal(JSON.parse(current.assignment.definition_json).categories["JR C"].min,15);
 }finally{h.close();}
});

test("only explicitly reviewed age divisions can supply an absent personal category",async()=>{
 const h=harness();try{
  const p=candidate({id:"division-age",category:null,protocol:false}),b=await active(h,p),definition={...rule(),divisionCategories:{"Junior C Women":{min:13,max:14}}};
  assert.equal((await h.request("age-rules","POST",{competitionId:p.item.competition.id,expectedBatchId:b.id,expectedRevision:null,definition,reviewer:"Test operator",reason:"Reviewed the explicit single-age division."})).status,200);
  const r=await profile(h,"division-age:1");assert.equal(r.age.status,"range");assert.equal(r.age.evidence[0].source.evidenceType,"reviewed-age-division");
 }finally{h.close();}
});

test("first upgraded correction restores verified legacy lineage inside the publication transaction",async()=>{
 const h=harness();try{
  const p=candidate({protocol:false}),a=await active(h,p);
  h.sqlite.exec("DELETE FROM publication_revisions; UPDATE import_batches SET competition_id=NULL");
  const next=structuredClone(p);next.baseBatchId=a.id;next.item.competition.location="Corrected after upgrade";
  const b=(await submit(h,next)).batch;
  assert.equal((await publish(h,b.id)).status,200);
  const history=await(await h.request("imports?competition="+p.item.competition.id+"&history=1","GET")).json();
  assert.equal(history.total,2);assert.equal(history.batches.find(x=>x.id===a.id).reviewer,"Test operator");
  assert.equal(h.sqlite.prepare("SELECT previous_batch_id FROM publication_revisions WHERE batch_id=?").get(b.id).previous_batch_id,a.id);
 }finally{h.close();}
});
