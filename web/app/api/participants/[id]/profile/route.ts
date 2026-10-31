import { database,unavailable } from "@/lib/database";
import { deriveSkatingAge,type AgeInterval } from "@/lib/skating-age";
import { categoryInterval,type AgeRule } from "@/lib/age-rules";
export const dynamic="force-dynamic";
export async function GET(_request:Request,context:{params:Promise<{id:string}>}){
  const {id}=await context.params;if(!/^[a-z0-9-]{1,80}:[^:]{1,80}$/.test(id))return Response.json({error:"Participant not found."},{status:404});
  try{
    const db=database();
    const [person,records,aliases]=await db.batch<Record<string, unknown>>([
      db.prepare("SELECT p.*,l.skater_id,l.status identity_status FROM participants p LEFT JOIN skater_links l ON l.participant_key=p.id WHERE p.id=?").bind(id),
      db.prepare(`SELECT o.*,c.discipline,s.url source_url,r.definition_json FROM skater_observations o
        JOIN skater_links l ON l.participant_key=o.participant_key
        JOIN import_publications pub ON pub.batch_id=o.batch_id AND pub.competition_id=o.competition_id
        JOIN competitions c ON c.id=o.competition_id JOIN sources s ON s.id=c.source_id
        LEFT JOIN competition_age_rules a ON a.competition_id=c.id LEFT JOIN age_rules r ON r.id=a.rule_id
        WHERE l.skater_id=(SELECT skater_id FROM skater_links WHERE participant_key=?) AND l.status!='needs_review'
        ORDER BY o.competed_on,o.competition_id,o.source_page,o.id`).bind(id),
      db.prepare("SELECT DISTINCT a.raw_name,a.name,a.source_page,a.batch_id FROM skater_aliases a JOIN skater_links l ON l.participant_key=a.participant_key JOIN import_publications pub ON pub.batch_id=a.batch_id WHERE l.skater_id=(SELECT skater_id FROM skater_links WHERE participant_key=?) AND l.status!='needs_review'").bind(id),
    ]);
    const participant=person.results[0];if(!participant)return Response.json({error:"Participant not found."},{status:404});
    const evidence:AgeInterval[]=[],unresolved:unknown[]=[],observations:unknown[]=[];
    for(const row of records.results){
      const {definition_json,...observation}=row;observations.push(observation);
      const rule=definition_json?JSON.parse(String(definition_json)) as AgeRule:null;
      const bounds=rule&&rule.season===row.season&&rule.discipline===row.discipline?(categoryInterval(row.age_category as string|null,rule) ?? (row.age_category===null?rule.divisionCategories?.[String(row.division)]??null:null)):null;
      if(bounds&&rule)evidence.push({season:String(row.season),basis:rule.basis,...bounds,source:{competitionId:row.competition_id,category:row.age_category??row.division,evidenceType:row.age_category?"explicit-category":"reviewed-age-division",sourceUrl:row.source_url,sourceHash:row.source_hash,page:row.source_page,baselineDate:rule.baselineDate,ruleVersion:rule.version,ruleSource:rule.source}});
      else if(row.age_category)unresolved.push({competitionId:row.competition_id,category:row.age_category,page:row.source_page,reason:"No reviewed matching rule/category."});
    }
    const age=deriveSkatingAge(evidence);
    return Response.json({participant,identityStatus:participant.identity_status??"unlinked",age:participant.identity_status==="needs_review"?{...age,status:"conflict",min:null,max:null,reason:"The current participant identity requires review."}:age,unresolvedAgeEvidence:unresolved,observations,aliases:aliases.results},{headers:{"Cache-Control":"no-store"}});
  }catch(error){return unavailable(error);}
}
