import { z } from "zod";
import { database, unavailable } from "@/lib/database";
import { importAuthorized, unauthorized } from "@/lib/imports/auth";
import { inputFailure,InputError,readJson } from "@/lib/imports/body";
import { canonical,hash } from "@/lib/imports/validation";
export const dynamic = "force-dynamic";
const decision = z.object({participantKey:z.string().min(1).max(180),expectedRevision:z.string().regex(/^[a-f0-9]{64}$/),expectedBatchId:z.string().regex(/^[a-f0-9]{64}$/),skaterId:z.string().regex(/^[a-f0-9]{20}$/).nullable(),reviewer:z.string().trim().min(1).max(300),reason:z.string().trim().min(1).max(2000),evidence:z.array(z.string().url().max(2000)).min(1).max(20)}).strict();
export async function POST(request:Request) {
  if (!importAuthorized(request)) return unauthorized();
  try {
    const parsed=decision.safeParse(await readJson(request)); if(!parsed.success) throw new InputError("A reviewed identity decision with current revisions and source references is required.");
    const d=parsed.data, db=database(), id=hash(canonical(d));
    const existing=await db.prepare("SELECT id FROM identity_decisions WHERE id = ?").bind(id).first();
    if(existing) return Response.json({id,recorded:true});
    const link=await db.prepare("SELECT l.*, p.name current_name, p.affiliation current_affiliation, pub.batch_id FROM skater_links l JOIN participants p ON p.id=l.participant_key JOIN import_publications pub ON pub.competition_id=l.competition_id WHERE l.participant_key = ?").bind(d.participantKey).first<{skater_id:string;revision:string;current_name:string;current_affiliation:string;batch_id:string}>();
    if(!link) throw new InputError("Participant not found.",404);
    if(link.revision!==d.expectedRevision||link.batch_id!==d.expectedBatchId) throw new InputError("The participant has changed. Review its current identity and publication.",409);
    const target=d.skaterId??hash(`reviewed-skater|${id}`).slice(0,20);
    if(d.skaterId&&!await db.prepare("SELECT id FROM skaters WHERE id = ?").bind(target).first()) throw new InputError("Target skater not found.",404);
    const now=new Date().toISOString();
    try { await db.batch<Record<string, unknown>>([
      db.prepare("INSERT INTO import_assertions (value) SELECT CASE WHEN (SELECT revision FROM skater_links WHERE participant_key = ?) = ? AND (SELECT batch_id FROM import_publications WHERE competition_id=(SELECT competition_id FROM skater_links WHERE participant_key = ?)) = ? THEN 1 ELSE 0 END").bind(d.participantKey,d.expectedRevision,d.participantKey,d.expectedBatchId),
      db.prepare("INSERT INTO skaters (id,display_name,created_at) VALUES (?,?,?) ON CONFLICT(id) DO NOTHING").bind(target,link.current_name,now),
      db.prepare("INSERT INTO identity_decisions (id,participant_key,previous_revision,previous_skater_id,skater_id,reviewer,reason,evidence_json,created_at) VALUES (?,?,?,?,?,?,?,?,?)").bind(id,d.participantKey,link.revision,link.skater_id,target,d.reviewer,d.reason,canonical(d.evidence),now),
      db.prepare("UPDATE skater_links SET skater_id=?,name=?,affiliation=?,status='reviewed',revision=? WHERE participant_key=?").bind(target,link.current_name,link.current_affiliation,id,d.participantKey),
      db.prepare("DELETE FROM import_assertions"),
    ]); } catch(error) {
      if(await db.prepare("SELECT id FROM identity_decisions WHERE id=?").bind(id).first()) return Response.json({id,skaterId:target,recorded:true});
      const after=await db.prepare("SELECT l.revision,p.batch_id FROM skater_links l JOIN import_publications p ON p.competition_id=l.competition_id WHERE participant_key=?").bind(d.participantKey).first<{revision:string;batch_id:string}>();
      if(after?.revision!==d.expectedRevision||after?.batch_id!==d.expectedBatchId)throw new InputError("Another identity or source revision was recorded first. Review the current participant.",409);
      throw error;
    }
    return Response.json({id,skaterId:target,recorded:true});
  } catch(error) { return inputFailure(error)??unavailable(error); }
}
export async function GET(request:Request) {
  if(!importAuthorized(request)) return unauthorized();
  const key=new URL(request.url).searchParams.get("participant"); if(!key||key.length>180) return Response.json({error:"A participant key is required."},{status:400});
  try {
    const db=database();const [links,history]=await db.batch<Record<string, unknown>>([db.prepare("SELECT l.*,p.name current_name,p.affiliation current_affiliation,pub.batch_id FROM skater_links l JOIN participants p ON p.id=l.participant_key JOIN import_publications pub ON pub.competition_id=l.competition_id WHERE participant_key=?").bind(key),db.prepare("SELECT * FROM identity_decisions WHERE participant_key=? ORDER BY created_at,id").bind(key)]);
    return Response.json({link:links.results[0]??null,decisions:history.results},{headers:{"Cache-Control":"no-store"}});
  } catch(error){return unavailable(error);}
}
