import { z } from "zod";
import { ageRuleContract } from "@/lib/age-rules";
import { COMPETITION_ID } from "@/lib/competition-id";
import { database, unavailable } from "@/lib/database";
import { importAuthorized, unauthorized } from "@/lib/imports/auth";
import { inputFailure,InputError,readJson } from "@/lib/imports/body";
import { canonical,hash } from "@/lib/imports/validation";
export const dynamic = "force-dynamic";
const contract=z.object({competitionId:z.string().regex(COMPETITION_ID),expectedBatchId:z.string().regex(/^[a-f0-9]{64}$/),expectedRevision:z.string().regex(/^[a-f0-9]{64}$/).nullable(),definition:ageRuleContract,reviewer:z.string().trim().min(1).max(300),reason:z.string().trim().min(1).max(2000)}).strict();
export async function POST(request:Request){
  if(!importAuthorized(request)) return unauthorized();
  try{
    const parsed=contract.safeParse(await readJson(request));if(!parsed.success) throw new InputError("A reviewed rule, source, season and current publication revision are required.");
    const d=parsed.data,db=database(),id=hash(canonical(d)),ruleId=hash(canonical(d.definition));
    if(await db.prepare("SELECT id FROM age_rule_decisions WHERE id=?").bind(id).first()) return Response.json({id,ruleId,recorded:true});
    const [competitions,current]=await db.batch<Record<string, unknown>>([db.prepare("SELECT c.discipline,c.season,p.batch_id FROM competitions c JOIN import_publications p ON p.competition_id=c.id WHERE c.id=?").bind(d.competitionId),db.prepare("SELECT revision FROM competition_age_rules WHERE competition_id=?").bind(d.competitionId)]);
    const c=competitions.results[0];if(!c) throw new InputError("Published competition not found.",404);
    if(c.discipline!==d.definition.discipline||c.season!==d.definition.season) throw new InputError("The rule must match the competition discipline and reviewed season.");
    if(c.batch_id!==d.expectedBatchId||(current.results[0]?.revision??null)!==d.expectedRevision) throw new InputError("The publication or rule assignment changed. Review the current revision.",409);
    const now=new Date().toISOString();
    try { await db.batch<Record<string, unknown>>([
      db.prepare("INSERT INTO import_assertions (value) SELECT CASE WHEN (SELECT batch_id FROM import_publications WHERE competition_id=?)=? AND (SELECT revision FROM competition_age_rules WHERE competition_id=?) IS ? THEN 1 ELSE 0 END").bind(d.competitionId,d.expectedBatchId,d.competitionId,d.expectedRevision),
      db.prepare("INSERT INTO age_rules (id,definition_json,reviewer,created_at) VALUES (?,?,?,?) ON CONFLICT(id) DO NOTHING").bind(ruleId,canonical(d.definition),d.reviewer,now),
      db.prepare("INSERT INTO age_rule_decisions (id,competition_id,previous_revision,rule_id,reviewer,reason,created_at) VALUES (?,?,?,?,?,?,?)").bind(id,d.competitionId,d.expectedRevision,ruleId,d.reviewer,d.reason,now),
      db.prepare("INSERT INTO competition_age_rules (competition_id,rule_id,revision,reviewer) VALUES (?,?,?,?) ON CONFLICT(competition_id) DO UPDATE SET rule_id=excluded.rule_id,revision=excluded.revision,reviewer=excluded.reviewer").bind(d.competitionId,ruleId,id,d.reviewer),
      db.prepare("DELETE FROM import_assertions"),
    ]); } catch(error) {
      if(await db.prepare("SELECT id FROM age_rule_decisions WHERE id=?").bind(id).first()) return Response.json({id,ruleId,recorded:true});
      const after=await db.prepare("SELECT a.revision,p.batch_id FROM import_publications p LEFT JOIN competition_age_rules a ON a.competition_id=p.competition_id WHERE p.competition_id=?").bind(d.competitionId).first<{revision:string|null;batch_id:string}>();
      if((after?.revision??null)!==d.expectedRevision||after?.batch_id!==d.expectedBatchId)throw new InputError("Another rule or source revision was recorded first. Review the current assignment.",409);
      throw error;
    }
    return Response.json({id,ruleId,recorded:true});
  }catch(error){return inputFailure(error)??unavailable(error);}
}
export async function GET(request:Request){
  if(!importAuthorized(request)) return unauthorized();
  const id=new URL(request.url).searchParams.get("competition");if(!id||!COMPETITION_ID.test(id))return Response.json({error:"A competition ID is required."},{status:400});
  try{
    const db=database();const [assignment,history]=await db.batch<Record<string, unknown>>([db.prepare("SELECT a.*,r.definition_json FROM competition_age_rules a JOIN age_rules r ON r.id=a.rule_id WHERE a.competition_id=?").bind(id),db.prepare("SELECT * FROM age_rule_decisions WHERE competition_id=? ORDER BY created_at,id").bind(id)]);
    return Response.json({assignment:assignment.results[0]??null,decisions:history.results},{headers:{"Cache-Control":"no-store"}});
  }catch(error){return unavailable(error);}
}
