import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {harness} from './support.mjs';
const fixtures=JSON.parse(execFileSync('python3',['-c','import json;from scripts.prepare_web_sample import prepare;print(json.dumps(prepare(True)))'],{cwd:new URL('../../',import.meta.url),encoding:'utf8'}));
function payload(index){const item=structuredClone(fixtures.competitions[index]);delete item.source.objectKey;return {schemaVersion:3,coverage:'selected-events',baseBatchId:null,review:{reviewer:'Source reviewer',seasonSourceLabel:'2025-2026',notes:'Reviewed exact AGN heading and roster entry scope.',confirmed:true},item};}
async function publish(h,p){const response=await h.request('imports','POST',p),b=await response.json();assert.equal(response.status,200,JSON.stringify(b.report));assert.equal((await h.request('imports/[id]/publish','POST',undefined,true,b.id)).status,200);return b;}
const detail=(h,q='',id='st-agn-2026')=>h.request('competitions/[id]'+q,'GET',undefined,false,id).then(r=>r.json());

test('Python preparation and server dimensions agree on every checked sample entry and result',()=>{const h=harness();try{const {dimensions}=h.load(new URL('../lib/imports/dimensions.ts',import.meta.url).pathname);for(const item of fixtures.competitions)assert.deepEqual(dimensions(item),item.dimensions);}finally{h.close();}});

test('AND filters, facet counts, all heats and same-number source groups stay consistent',async()=>{const h=harness();try{await publish(h,payload(0));
 const all=await detail(h);assert.equal(all.results.length,67);assert.equal(new Set(all.results.map(r=>r.id)).size,67);
 const women=await detail(h,'?gender=Women&division=Junior+E&distance=700&round=Quarter-Finals');assert.equal(women.matching.results,14);assert.equal(women.events.length,1);assert.equal(women.events[0].heat_count,3);assert.ok(women.results.every(r=>r.gender==='Women'&&r.division_key==='Junior E'&&r.entry_id));
 assert.equal(women.options.gender.find(o=>o.value==='Men').count,39);assert.equal(women.options.round.find(o=>o.value==='Semi-Finals').count,14);
 const division=await detail(h,'?division=Junior+E');assert.equal(division.results.length,67);assert.equal(division.events.length,4);assert.equal(new Set(division.events.filter(e=>e.source_event_number==='9').map(e=>e.competition_group)).size,2);
 const narrowed=await detail(h,'?event='+women.events[0].id);assert.equal(narrowed.matching.results,14);assert.equal(narrowed.events.length,1);assert.ok(narrowed.options.gender.every(o=>o.value==='Women'));
 const empty=await detail(h,'?gender=Women&division=Master&distance=500');assert.equal(empty.matching.results,0);assert.equal(empty.results.length,0);assert.equal(empty.competition.result_count,67);assert.deepEqual(empty.filters,{gender:'Women',division:'Master',distance:'500'});
 assert.equal((await h.request('competitions/[id]?distance=bad','GET',undefined,false,'st-agn-2026')).status,400);
 }finally{h.close();}});

test('forged structured entry links fail validation and unsupported evidence stays Unknown',async()=>{const h=harness();try{
 const p=payload(1);p.item.dimensions.results[0].entryId=p.item.entries[0].id;const r=await h.request('imports','POST',p),b=await r.json();assert.equal(r.status,422);assert.ok(b.report.errors.some(e=>e.code==='DIMENSION_EVIDENCE'));
 const {dimensions}=h.load(new URL('../lib/imports/dimensions.ts',import.meta.url).pathname);p.item.source.sha256='f'.repeat(64);const d=dimensions(p.item);assert.ok(d.results.every(r=>r.entryId===null&&r.division==='Unknown'));assert.ok(d.events.every(e=>e.status==='needs-review'));
 }finally{h.close();}});

test('mixed gender source events retain their meaning while roster gender filters select exact rows',async()=>{const h=harness();try{
 const p=payload(0),{dimensions}=h.load(new URL('../lib/imports/dimensions.ts',import.meta.url).pathname);
 // Use a synthetic projection to test query semantics independently of parser validation.
 await publish(h,p);const id=p.item.competition.id,event=h.sqlite.prepare("SELECT id FROM competition_events WHERE gender='Women' AND round='Quarter-Finals' LIMIT 1").get().id;
 h.sqlite.prepare("UPDATE competition_events SET gender='Mixed',division_key='Group 1 Master' WHERE id=?").run(event);
 h.sqlite.prepare("UPDATE results SET division_key='Group 1 Master' WHERE event_key=?").run(event);
 const mixed=await detail(h,'?gender=Mixed');assert.equal(mixed.events.length,1);assert.equal(mixed.events[0].gender,'Mixed');assert.equal(mixed.results.length,14);
 const women=await detail(h,'?gender=Women&division=Group+1+Master');assert.equal(women.results.length,14);assert.equal(women.events[0].gender,'Mixed');
 const item=structuredClone(p.item);item.evidence.events[0].results.forEach(r=>r.group_label="Group A Group 1 Master's");item.entries.forEach(e=>{e.division='Group 1 Master';});item.evidence.roster.observations.forEach(o=>{o.division_raw='Group 1 Master';});const d=dimensions(item);assert.equal(d.events[0].gender,'Mixed');assert.equal(d.events[0].competitionGroup,'Group A');
 }finally{h.close();}});

test('multiple entries resolve by source scope and duplicate applicable entries stay unresolved',()=>{const h=harness();try{
 const p=payload(1),{dimensions}=h.load(new URL('../lib/imports/dimensions.ts',import.meta.url).pathname);
 const person=p.item.participants.find(p=>p.bib==='370'),entries=p.item.entries.filter(e=>e.participantId===person.id);assert.equal(entries.length,2);
 const e=p.item.evidence.events.at(-1);e.results[0].group_label="Master Women's";const r=p.item.results.at(-5);r.participantId=person.id;
 // Bind an existing result to the explicit Master source event without using bib-wide divisions.
 const row=p.item.results.find(r=>r.eventKey===p.item.results.at(-1).eventKey);row.participantId=person.id;
 let d=dimensions(p.item);const target=d.results.find(r=>r.id===row.id);assert.equal(target.division,'Master');assert.equal(target.entryId,entries.find(e=>e.division==='Master Women').id);
 p.item.entries.push({...entries.find(e=>e.division==='Master Women'),id:'duplicate-entry'});d=dimensions(p.item);assert.equal(d.results.find(r=>r.id===row.id).entryId,null);assert.equal(d.results.find(r=>r.id===row.id).status,'needs-review');
 }finally{h.close();}});

test('skater search and history paginate across linked disciplines without duplicating multi-entry results',async()=>{const h=harness();try{
 await publish(h,payload(0));await publish(h,payload(1));
 const list=await(await h.request('skaters?q=&page=1','GET',undefined,false)).json();assert.equal(list.total,288);assert.equal(list.skaters.length,25);const next=await(await h.request('skaters?page=2','GET',undefined,false)).json();assert.equal(new Set([...list.skaters,...next.skaters].map(r=>r.id)).size,50);
 const search=await(await h.request('skaters?q=Andrea+Sudjapun','GET',undefined,false)).json();assert.equal(search.total,1);
 const sameName=await(await h.request('skaters?q=Sara+Cushman','GET',undefined,false)).json();assert.equal(sameName.total,1);assert.equal(sameName.skaters[0].competition_count,2);
 const rec=await(await h.request('participants/[id]/records?discipline=short-track&season=2025-2026','GET',undefined,false,'st-agn-2026:185')).json();assert.equal(rec.total,2);assert.equal(new Set(rec.results.map(r=>r.id)).size,2);assert.ok(rec.results.every(r=>r.entry_division==='Junior E Women'));
 const none=await(await h.request('participants/[id]/records?discipline=short-track&season=2024-2025','GET',undefined,false,'st-agn-2026:185')).json();assert.equal(none.total,0);
 const literal=await(await h.request('skaters?q=%25','GET',undefined,false)).json();assert.equal(literal.total,0);
 }finally{h.close();}});

test('reviewed links combine history only while both identities remain approved',async()=>{const h=harness();try{
 await publish(h,payload(0));await publish(h,payload(1));const a='st-agn-2026:185',b='lt-agn-2026:368',skater=h.sqlite.prepare('SELECT skater_id FROM skater_links WHERE participant_key=?').get(a).skater_id;
 h.sqlite.prepare("UPDATE skater_links SET skater_id=?,status='reviewed' WHERE participant_key=?").run(skater,b);
 let history=await(await h.request('participants/[id]/records?discipline=short-track&season=2025-2026','GET',undefined,false,b)).json();assert.equal(history.scopes.length,2);assert.equal(history.total,2);assert.ok(history.results.every(r=>r.participant_id===a));
 h.sqlite.prepare("UPDATE skater_links SET status='needs_review' WHERE participant_key=?").run(b);
 history=await(await h.request('participants/[id]/records?discipline=long-track&season=2025-2026','GET',undefined,false,b)).json();assert.equal(history.scopes.length,1);assert.equal(history.total,1);assert.ok(history.results.every(r=>r.participant_id===b));
 const isolated=await(await h.request('participants/[id]/records?discipline=short-track&season=2025-2026','GET',undefined,false,b)).json();assert.equal(isolated.total,0);
 const profile=await(await h.request('participants/[id]/profile','GET',undefined,false,b)).json();assert.equal(profile.observations.length,0);assert.equal(profile.age.status,'conflict');
 }finally{h.close();}});


test('athlete race history is available without required scope selection',async()=>{const h=harness();try{
 await publish(h,payload(0));const id='st-agn-2026:185';
 for(const query of ['', '?discipline=short-track', '?season=2025-2026']){
  const response=await h.request('participants/[id]/records'+query,'GET',undefined,false,id),data=await response.json();
  assert.equal(response.status,200);assert.equal(data.selectionRequired,false);assert.equal(data.total,2);assert.equal(data.results.length,2);
 }
 for(const query of ['?discipline=&season=2025-2026','?discipline=short-track&season=2025-2027'])assert.equal((await h.request('participants/[id]/records'+query,'GET',undefined,false,id)).status,400);
 }finally{h.close();}});

const pb=(h,id='st-agn-2026:185',query='')=>h.request('participants/[id]/personal-bests'+query,'GET',undefined,false,id).then(r=>r.json());
function addResult(h,overrides){const row={...h.sqlite.prepare('SELECT * FROM results WHERE participant_id=? LIMIT 1').get(overrides.participant_id??'st-agn-2026:185'),...overrides};const cols=Object.keys(row);h.sqlite.prepare(`INSERT INTO results (${cols.join(',')}) VALUES (${cols.map(()=>'?').join(',')})`).run(...Object.values(row));}

test('personal bests are exact minima per discipline and distance with every tied source retained',async()=>{const h=harness();try{
 await publish(h,payload(0));const original=h.snapshot().results.filter(r=>r.participant_id==='st-agn-2026:185');
 let data=await pb(h);assert.equal(data.personalBests.length,1);assert.equal(data.personalBests[0].time_microseconds,Math.min(...original.map(r=>r.time_microseconds)));assert.equal(data.personalBests[0].distance,700);
 addResult(h,{id:'pb-tie-a',distance:500,time_raw:'0:50.123456',time_microseconds:50123456,result_status:null});addResult(h,{id:'pb-tie-b',distance:500,time_raw:'0:50.123456',time_microseconds:50123456,result_status:null});addResult(h,{id:'pb-slower',distance:500,time_raw:'0:50.123457',time_microseconds:50123457,result_status:null});addResult(h,{id:'pb-1000',distance:1000,time_raw:'1:40.000',time_microseconds:100000000,result_status:null});
 data=await pb(h);assert.equal(data.personalBests.length,3);const best=data.personalBests.find(b=>b.distance===500);assert.equal(best.time_microseconds,50123456);assert.deepEqual(best.performances.map(r=>r.id).sort(),['pb-tie-a','pb-tie-b']);assert.ok(best.performances.every(r=>r.competition_title&&r.source_url&&r.source_page&&r.race_id));
 }finally{h.close();}});

test('status records and missing or zero times never establish personal bests',async()=>{const h=harness();try{
 await publish(h,payload(0));for(const status of ['PEN','DNS','DNF','DQ','FNT','YC'])addResult(h,{id:'pb-'+status,distance:500,time_microseconds:1000000,time_raw:'0:01.000',result_status:status});addResult(h,{id:'pb-missing',distance:500,time_microseconds:null,time_raw:null,result_status:null});addResult(h,{id:'pb-zero',distance:500,time_microseconds:0,time_raw:'0:00.000',result_status:null});
 const data=await pb(h);assert.equal(data.personalBests.length,1);assert.equal(data.personalBests[0].distance,700);assert.equal(data.coverage.comparable_result_count,2);assert.equal(data.coverage.recorded_result_count,10);
 h.sqlite.prepare("UPDATE results SET result_status='DNS' WHERE participant_id=?").run('st-agn-2026:185');assert.deepEqual((await pb(h)).personalBests,[]);
 }finally{h.close();}});

test('personal bests span all seasons without using directory or history query filters',async()=>{const h=harness();try{
 await publish(h,payload(0));const source=h.sqlite.prepare('SELECT source_id FROM competitions LIMIT 1').get().source_id;
 h.sqlite.prepare('INSERT INTO competitions VALUES (?,?,?,?,?,?,?,?)').run('older-race','Earlier competition','short-track','2024-2025','2025-02-01','2025-02-02','Earlier rink',source);
 h.sqlite.prepare('INSERT INTO participants (id,competition_id,bib,name,affiliation) VALUES (?,?,?,?,?)').run('older-race:1','older-race','1','Reviewed skater','Earlier club');const link=h.sqlite.prepare('SELECT * FROM skater_links WHERE participant_key=?').get('st-agn-2026:185');h.sqlite.prepare('INSERT INTO skater_links VALUES (?,?,?,?,?,?,?,?)').run('older-race:1','older-race','1',link.skater_id,'Reviewed skater','Earlier club','reviewed','test');
 addResult(h,{id:'pb-earlier',competition_id:'older-race',participant_id:'st-agn-2026:185',distance:700,time_microseconds:70000000,time_raw:'1:10.000',result_status:null});h.sqlite.prepare('UPDATE results SET participant_id=? WHERE id=?').run('older-race:1','pb-earlier');
 const data=await pb(h,'st-agn-2026:185','?discipline=long-track&season=2025-2026');assert.equal(data.seasonScope,'all-published-seasons');assert.equal(data.coverage.season_count,2);assert.equal(data.personalBests[0].performances[0].id,'pb-earlier');assert.equal(data.personalBests[0].performances[0].season,'2024-2025');
 }finally{h.close();}});

test('short and long track bests stay separate and identity links require review',async()=>{const h=harness();try{
 await publish(h,payload(0));await publish(h,payload(1));const a='st-agn-2026:185',b='lt-agn-2026:368';const target=h.sqlite.prepare('SELECT skater_id FROM skater_links WHERE participant_key=?').get(a).skater_id;
 assert.ok((await pb(h,a)).personalBests.every(r=>r.discipline==='short-track'));h.sqlite.prepare("UPDATE skater_links SET skater_id=?,status='reviewed' WHERE participant_key=?").run(target,b);
 let data=await pb(h,a);assert.deepEqual(new Set(data.personalBests.map(r=>r.discipline)),new Set(['short-track','long-track']));
 // Equal distances across disciplines still produce independent PB rows.
 addResult(h,{id:'pb-short-500',participant_id:a,distance:500,time_microseconds:50000000,time_raw:'0:50.000',result_status:null});data=await pb(h,a);assert.equal(data.personalBests.filter(r=>r.distance===500).length,2);
 h.sqlite.prepare("UPDATE skater_links SET status='needs_review' WHERE participant_key=?").run(b);assert.ok((await pb(h,a)).personalBests.every(r=>r.discipline==='short-track'));assert.ok((await pb(h,b)).personalBests.every(r=>r.discipline==='long-track'));
 }finally{h.close();}});

test('personal best aggregation includes records beyond the first 50 history rows',async()=>{const h=harness();try{
 await publish(h,payload(0));for(let n=0;n<60;n++)addResult(h,{id:'pb-many-'+n,distance:500,time_microseconds:60000000+n,time_raw:'1:00.000',result_status:null});addResult(h,{id:'pb-last-best',distance:500,time_microseconds:49000000,time_raw:'0:49.000',result_status:null});
 const data=await pb(h);assert.equal(data.personalBests.find(r=>r.distance===500).performances[0].id,'pb-last-best');assert.equal(data.coverage.recorded_result_count,63);
 assert.equal((await h.request('participants/[id]/personal-bests','GET',undefined,false,'missing:1')).status,404);
 }finally{h.close();}});

test('reviewed search cards use one representative source record and a query-independent identity status',async()=>{const h=harness();try{
 const st=await publish(h,payload(0));await publish(h,payload(1));
 // Test-only reviewed linkage between differently named fixture records.
 const selected='st-agn-2026:185',anchor='lt-agn-2026:368';
 const link=h.sqlite.prepare('SELECT * FROM skater_links WHERE participant_key=?').get(selected);
 const target=h.sqlite.prepare('SELECT skater_id FROM skater_links WHERE participant_key=?').get(anchor).skater_id;
 const decision={participantKey:selected,expectedRevision:link.revision,expectedBatchId:st.id,skaterId:target,reviewer:'Test reviewer',reason:'Test-only linkage for search representative consistency.',evidence:['https://www.usspeedskating.org/results']};
 assert.equal((await h.request('identity','POST',decision)).status,200);
 const search=(q,page=1)=>h.request('skaters?q='+encodeURIComponent(q)+'&page='+page,'GET',undefined,false).then(r=>r.json());
 const findCard=async(q,predicate)=>{let data=await search(q);const pages=Math.ceil(data.total/data.pageSize);for(let page=1;page<=pages;page++){if(page>1)data=await search(q,page);const card=data.skaters.find(predicate);if(card)return card;}return undefined;};
 const grouped=await findCard('Lin',p=>p.identity_key===target);
 assert.ok(grouped);assert.equal(grouped.id,anchor);assert.equal(grouped.name,'Luciana Molinares Rodriguez');assert.equal(grouped.identity_status,'reviewed');assert.equal(grouped.competition_count,2);
 const profile=await(await h.request('participants/[id]/profile','GET',undefined,false,grouped.id)).json();assert.equal(grouped.name,profile.participant.name);
 const anchorOnly=await search('Luciana');assert.equal(anchorOnly.total,1);assert.equal(anchorOnly.skaters[0].id,anchor);assert.equal(anchorOnly.skaters[0].identity_status,'reviewed');assert.equal(anchorOnly.skaters[0].competition_count,1);
 const reviewedOnly=await search('Lindsay');assert.equal(reviewedOnly.skaters[0].id,selected);assert.equal(reviewedOnly.skaters[0].name,'Lindsay Lin');assert.equal(reviewedOnly.skaters[0].identity_status,'reviewed');
 h.sqlite.prepare("UPDATE skater_links SET status='needs_review' WHERE participant_key=?").run(selected);
 const pending=await findCard('Lin',p=>p.id===selected),local=await findCard('Lin',p=>p.id===anchor);
 assert.equal(pending.identity_status,'needs_review');assert.equal(local.identity_status,'competition-local');assert.equal(pending.competition_count,1);assert.equal(local.competition_count,1);
 }finally{h.close();}});
