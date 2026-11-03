import {test} from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './support.mjs';
import {execFileSync} from 'node:child_process';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const fixtures=JSON.parse(execFileSync('python3',['-c','import json;from scripts.prepare_web_sample import prepare;print(json.dumps(prepare(True)))'],{cwd:new URL('../../',import.meta.url),encoding:'utf8'}));

async function ready() {
 const h=harness();
 for(const item of structuredClone(fixtures).competitions){
  delete item.source.objectKey;
  const response=await h.request('imports','POST',{schemaVersion:3,coverage:'selected-events',baseBatchId:null,review:{reviewer:'Test reviewer',seasonSourceLabel:'2025-2026',notes:'Checked original sample protocol.',confirmed:true},item});
  const body=await response.json();assert.equal(response.status,200,JSON.stringify(body.report));
  assert.equal((await h.request('imports/[id]/publish','POST',undefined,true,body.id)).status,200);
 }
 return h;
}
const query=(h,values={})=>h.request('performances?'+new URLSearchParams({participant:'st-agn-2026:185',discipline:'short-track',distance:'700',...values}),'GET',undefined,false);
function add(h,overrides={}) { const row={...h.sqlite.prepare("SELECT * FROM results WHERE participant_id='st-agn-2026:185' LIMIT 1").get(),...overrides};const cols=Object.keys(row);h.sqlite.prepare(`INSERT INTO results (${cols}) VALUES (${cols.map(()=>'?')})`).run(...Object.values(row));return row; }
function domain(h){return h.load(new URL('../lib/performance.ts',import.meta.url).pathname);}

test('performance query preserves every source appearance, exact timing, scopes and statuses',async()=>{const h=await ready();try{
 for(const status of ['PEN','DNS','DNF','DQ','FNT','YC'])add(h,{id:'status-'+status,result_status:status,time_microseconds:1,time_raw:'0:00.000001'});
 add(h,{id:'missing',time_microseconds:null,time_raw:null});add(h,{id:'zero',time_microseconds:0});
 const r=await query(h),d=await r.json();assert.equal(r.status,200);assert.equal(d.selectionRequired,false);assert.equal(d.trackSpecification,null);assert.equal(d.records.length,10);
 assert.ok(d.records.every(r=>r.discipline==='short-track'&&r.distance===700&&r.series_id==='st-agn-2026:185'&&r.competition_title&&r.source_url&&r.source_page&&r.event_key&&r.race_id&&r.starts_on&&r.ends_on));
 const {performancePoints}=domain(h);assert.equal(performancePoints(d.competitionBests).length,1);assert.equal(new Set(d.records.map(r=>r.id)).size,10);
 const source=h.snapshot().results.filter(r=>r.participant_id==='st-agn-2026:185');for(const row of d.records)for(const [key,value]of Object.entries(source.find(r=>r.id===row.id)))assert.equal(row[key],value,key);
 const meta=await(await h.request('performances?participant=st-agn-2026:185','GET',undefined,false)).json();assert.equal(meta.selectionRequired,true);assert.deepEqual(meta.records,[]);assert.ok(meta.options.length);
 assert.deepEqual((await(await query(h,{discipline:'long-track'})).json()).records,[]);
 assert.deepEqual((await(await query(h,{distance:'500'})).json()).records,[]);
 }finally{h.close();}});

test('inclusive competition ranges and legacy round parameters preserve whole-competition scope',async()=>{const h=await ready();try{
 const d=await(await query(h)).json(),row=d.records[0];assert.notEqual(row.starts_on,row.ends_on);
 assert.equal((await(await query(h,{from:row.ends_on,to:row.ends_on})).json()).records.length,2);
 assert.equal((await(await query(h,{to:'2020-01-01'})).json()).records.length,0);
 assert.equal((await(await query(h,{round:'Not a round'})).json()).records.length,2);
 const scoped=await(await query(h,{round:row.round})).json();assert.equal(scoped.records.length,2);assert.deepEqual(scoped.competitionBests,d.competitionBests);
 const {competitionDates,dated}=domain(h);assert.match(competitionDates(row),/competition range/);assert.equal(dated({...row,starts_on:''}),false);assert.match(competitionDates({...row,ends_on:null}),/unknown/);
 }finally{h.close();}});

test('one competition-best point keeps exact minima and all tied source evidence',async()=>{const h=await ready();try{
 add(h,{id:'exact-a',time_microseconds:50123456,time_raw:'0:50.123456'});add(h,{id:'exact-b',time_microseconds:50123456,time_raw:'0:50.123456'});add(h,{id:'one-us-slower',time_microseconds:50123457,time_raw:'0:50.123457'});
 const d=await(await query(h)).json(),{competitionBests,performancePoints,trendSegments,timeLabel}=domain(h),best=performancePoints(d.competitionBests);
 assert.equal(d.records.length,5);assert.equal(best.length,1);assert.equal(best[0].id,'exact-a');assert.deepEqual(best[0].performances.map(r=>r.id),['exact-a','exact-b']);assert.equal(timeLabel(best[0].time_microseconds),'0:50.123456');assert.deepEqual(trendSegments(best),[]);
 assert.deepEqual(competitionBests([...d.records].reverse()),d.competitionBests);
 const base=best[0],earlier={...base,id:'earlier',competition_id:'earlier',starts_on:'2025-02-01',ends_on:'2025-02-02'};
 assert.equal(trendSegments([base,earlier]).length,1);assert.equal(trendSegments([base,{...earlier,ends_on:base.starts_on}]).length,0);
 const undated=competitionBests(d.records.map(r=>({...r,starts_on:'unknown'})));assert.equal(undated.length,1);assert.equal(performancePoints(undated).length,0);
 }finally{h.close();}});

test('comparison uses reviewed identity scope, deduplicates selections and isolates pending links',async()=>{const h=await ready();try{
 const a='st-agn-2026:185',b='lt-agn-2026:368',skater=h.sqlite.prepare('SELECT skater_id FROM skater_links WHERE participant_key=?').get(a).skater_id;
 const before=h.sqlite.prepare('SELECT COUNT(*) n FROM identity_decisions').get().n;
 const request=()=>h.request('performances?'+new URLSearchParams([['participant',a],['participant',b],['discipline','short-track'],['distance','700']]),'GET',undefined,false).then(r=>r.json());
 let d=await request();assert.equal(d.series.length,2);assert.equal(d.records.length,2);
 h.sqlite.prepare("UPDATE skater_links SET skater_id=?,status='reviewed' WHERE participant_key=?").run(skater,b);
 d=await request();assert.equal(d.series.length,1);assert.equal(new Set(d.records.map(r=>r.id)).size,2);
 d=await(await query(h,{participant:b})).json();assert.equal(d.records.length,2);assert.ok(d.records.every(r=>r.series_id===b));
 h.sqlite.prepare("UPDATE skater_links SET status='needs_review' WHERE participant_key=?").run(b);
 d=await request();assert.equal(d.series.length,2);assert.equal(d.records.length,2);
 assert.equal((await(await query(h,{participant:b})).json()).records.length,0);
 assert.equal(h.sqlite.prepare('SELECT COUNT(*) n FROM identity_decisions').get().n,before);
 }finally{h.close();}});

test('all seasons and more than one history page survive chart queries without affecting PBs',async()=>{const h=await ready();try{
 const source=h.sqlite.prepare('SELECT source_id FROM competitions LIMIT 1').get().source_id;
 h.sqlite.prepare('INSERT INTO competitions VALUES (?,?,?,?,?,?,?,?)').run('earlier','Earlier competition','short-track','2024-2025','2025-02-01','2025-02-02','Test rink',source);
 h.sqlite.prepare('INSERT INTO participants VALUES (?,?,?,?,?)').run('earlier:1','earlier','1','Reviewed test skater','Test club');const link=h.sqlite.prepare("SELECT * FROM skater_links WHERE participant_key='st-agn-2026:185'").get();
 h.sqlite.prepare('INSERT INTO skater_links VALUES (?,?,?,?,?,?,?,?)').run('earlier:1','earlier','1',link.skater_id,'Reviewed test skater','Test club','reviewed','test');
 for(let i=0;i<60;i++)add(h,{id:'earlier-'+i,participant_id:'earlier:1',competition_id:'earlier',time_microseconds:50123456+i});
 const all=await(await query(h)).json();assert.equal(all.records.length,62);assert.equal(all.competitionBests.length,2);assert.ok(all.competitionBests.some(b=>b.id==='earlier-0'));assert.equal(new Set(all.records.map(r=>r.season)).size,2);
 assert.equal((await(await query(h,{from:'2026-01-01'})).json()).records.length,2);
 const pb=await(await h.request('participants/[id]/personal-bests?from=2026-01-01','GET',undefined,false,'st-agn-2026:185')).json();assert.equal(pb.personalBests[0].time_microseconds,50123456);
 }finally{h.close();}});

test('invalid chart filters fail clearly and unknown participants return 404',async()=>{const h=await ready();try{
 for(const values of [{discipline:'mixed'},{distance:'0'},{distance:'700.5'},{round:''},{from:'2026-02-30'},{from:'2026-03-22',to:'2026-03-20'},{participant:'invalid'}])assert.equal((await query(h,values)).status,400,JSON.stringify(values));
 assert.equal((await query(h,{participant:'unknown:1'})).status,404);
 assert.equal((await h.request('performances','GET',undefined,false)).status,400);
 const params=new URLSearchParams();for(let i=0;i<5;i++)params.append('participant',`test:${i}`);assert.equal((await h.request('performances?'+params,'GET',undefined,false)).status,400);
 }finally{h.close();}});

test('rendered symbols, tooltips and list rows share the exact result and source evidence',async()=>{const h=await ready();try{
 add(h,{id:'render-tie-a',time_microseconds:50123456,time_raw:'0:50.123456',source_page:75});add(h,{id:'render-tie-b',time_microseconds:50123456,time_raw:'0:50.123456',source_page:85});
 const data=await(await query(h)).json(),{competitionBests,performancePoints,chartPoint}=domain(h);
 const {PerformanceRows,PerformanceSymbol,PerformanceTooltip}=h.load(new URL('../components/performance-presentation.tsx',import.meta.url).pathname);
 const points=performancePoints(data.competitionBests),ids=new Set(points.map(r=>r.id));
 const markup=renderToStaticMarkup(createElement('table',null,createElement('tbody',null,createElement(PerformanceRows,{rows:data.competitionBests,pointIds:ids,selectedId:null,inspect:()=>{},onRace:()=>{}}))));
 assert.equal((markup.match(/data-result-id=/g)||[]).length,data.competitionBests.length);assert.equal((markup.match(/Select point/g)||[]).length,points.length);
 for(const r of points){
  const point=chartPoint(r);assert.equal(point.x,Date.parse(r.starts_on));assert.equal(point.y,r.time_microseconds);assert.equal(point.record,r);
  const symbol=renderToStaticMarkup(createElement('svg',null,createElement(PerformanceSymbol,{record:r,cx:100,cy:100,color:'#264b41',number:1,selected:false,inspect:()=>{}})));
  const tooltip=renderToStaticMarkup(createElement(PerformanceTooltip,{record:r}));
  assert.ok(symbol.includes(`data-result-id="${r.id}"`));assert.ok(symbol.includes(`race ${r.race_id}, source page ${r.source_page}`));
  assert.ok(tooltip.includes(r.time_raw));assert.ok(tooltip.includes(r.competition_title));assert.ok(tooltip.includes(r.starts_on)&&tooltip.includes(r.ends_on));assert.ok(tooltip.includes(`Race ${r.race_id}`)&&tooltip.includes(`Source p. ${r.source_page}`));
  assert.ok(markup.includes(`href="${r.source_url}#page=${r.source_page}"`));assert.ok(markup.includes(`data-result-id="${r.id}"`));
 }
 assert.ok(markup.includes('2 equal-best performances'));assert.ok(markup.includes('#page=75')&&markup.includes('#page=85'));
 const tooltip=renderToStaticMarkup(createElement(PerformanceTooltip,{record:points[0]}));assert.ok(tooltip.includes('2 equal-best source performances'));
 for(const status of ['PEN','DNS','DNF','DQ','FNT','YC']){
  const r={...data.records[0],id:'render-'+status,result_status:status,time_microseconds:null,time_raw:null};
  assert.deepEqual(competitionBests([r]),[]);
 }
 }finally{h.close();}});


test('competition best grouping combines rounds and source groups while isolating identities, competitions and distances',async()=>{const h=await ready();try{
 const data=await(await query(h)).json(),{competitionBests}=domain(h),base=data.records[0];
 const rows=[{...base,id:'heat',round:'Quarter-Finals',time_microseconds:50123457},{...base,id:'final',round:'Finals',time_microseconds:50123456,event_key:'other-final',event_gender:'Mixed',competition_group:'Group B',entry_division:'Master'},{...base,id:'other-person',series_id:'other:1'},{...base,id:'other-competition',competition_id:'other'},{...base,id:'other-distance',distance:500},{...base,id:'other-discipline',discipline:'long-track'}];
 const bests=competitionBests(rows);assert.equal(bests.length,5);assert.ok(bests.some(b=>b.id==='final'));assert.ok(!bests.some(b=>b.id==='heat'));
 }finally{h.close();}});
