import { database } from "@/lib/database";
import { categoryInterval,type AgeRule } from "@/lib/age-rules";
import { deriveSkatingAge,type AgeInterval } from "@/lib/skating-age";
import type { ImportPayload } from "@/lib/imports/validation";
export async function previewAgeConstraints(payload:ImportPayload){
 const db=database(),item=payload.item,keys=JSON.stringify(item.participants.map(p=>p.id));
 const [links,assignments,observations]=await db.batch<Record<string,unknown>>([
  db.prepare("SELECT * FROM skater_links WHERE participant_key IN (SELECT value FROM json_each(?))").bind(keys),
  db.prepare("SELECT a.revision,r.definition_json FROM competition_age_rules a JOIN age_rules r ON r.id=a.rule_id WHERE a.competition_id=?").bind(item.competition.id),
  db.prepare(`SELECT o.season,o.age_category,o.division,c.discipline,l.skater_id,r.definition_json FROM skater_observations o
   JOIN skater_links l ON l.participant_key=o.participant_key JOIN import_publications p ON p.batch_id=o.batch_id AND p.competition_id=o.competition_id JOIN competitions c ON c.id=o.competition_id
   LEFT JOIN competition_age_rules a ON a.competition_id=o.competition_id LEFT JOIN age_rules r ON r.id=a.rule_id
   WHERE o.competition_id!=? AND l.status!='needs_review' AND l.skater_id IN (SELECT skater_id FROM skater_links WHERE participant_key IN (SELECT value FROM json_each(?)))`).bind(item.competition.id,keys),
 ]);
 const rule=assignments.results[0]?.definition_json?JSON.parse(String(assignments.results[0].definition_json)) as AgeRule:null;
 const applicable=rule?.season===item.competition.season&&rule?.discipline===item.competition.discipline?rule:null;
 const intervals=new Map<string,AgeInterval[]>(),unresolved=new Set<string>(),identityReview:string[]=[],participantKeys=new Map<string,string[]>();
 const add=(skater:string,season:string,category:string|null,division:string,discipline:string,definition:AgeRule|null)=>{
  const bounds=definition?.season===season&&definition?.discipline===discipline ? categoryInterval(category,definition)??(category===null?definition.divisionCategories?.[division]??null:null):null;
  if(!bounds||!definition)return false;
  const list=intervals.get(skater)??[];list.push({season,basis:definition.basis,...bounds,source:{category:category??division,ruleVersion:definition.version}});intervals.set(skater,list);return true;
 };
 for(const row of observations.results)add(String(row.skater_id),String(row.season),row.age_category as string|null,String(row.division),String(row.discipline),row.definition_json?JSON.parse(String(row.definition_json)) as AgeRule:null);
 for(const p of item.participants){
  const link=links.results.find(l=>l.participant_key===p.id),skater=String(link?.skater_id??`local:${p.id}`);
  if(link&&(link.status==='needs_review'||link.name!==p.name||link.affiliation!==p.affiliation)){identityReview.push(p.id);continue;}
  participantKeys.set(skater,[...(participantKeys.get(skater)??[]),p.id]);
  for(const o of item.evidence.roster.observations.filter(o=>o.bib===p.bib))if(!add(skater,item.competition.season,o.age_status_raw,o.division_raw,item.competition.discipline,applicable))unresolved.add(o.age_status_raw??o.division_raw);
 }
 const conflicts=[...participantKeys].filter(([skater])=>deriveSkatingAge(intervals.get(skater)??[]).status==='conflict').map(([skaterId,participantKeys])=>({skaterId,participantKeys}));
 return {basis:"reviewed-active-evidence-at-submission",checkedAt:new Date().toISOString(),referenceSeason:deriveSkatingAge([]).season,ruleRevision:applicable?String(assignments.results[0].revision):null,checkedSkaters:participantKeys.size,conflicts,identityReview,unresolvedCategories:[...unresolved].sort()};
}
