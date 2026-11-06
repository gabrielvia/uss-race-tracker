import { database, unavailable } from "@/lib/database";
import { participantRecordScope, recordJoin, recordSelect } from "@/lib/skater-records";
export const dynamic = "force-dynamic";

type Performance = Record<string,unknown> & {discipline:string;distance:number;time_microseconds:number};
export async function GET(_request:Request,context:{params:Promise<{id:string}>}) {
  const {id}=await context.params;
  if(!/^[a-z0-9-]{1,80}:[^:]{1,80}$/.test(id))return Response.json({error:"Participant not found."},{status:404});
  try {
    const db=database();
    // Exact integer timing determines the minimum across every active published
    // season, not a paginated history slice. All equal-best performances survive.
    const [person,coverage,bests]=await db.batch<Record<string,unknown>>([
      db.prepare("SELECT p.id,COALESCE(l.status,'unlinked') identity_status FROM participants p LEFT JOIN skater_links l ON l.participant_key=p.id WHERE p.id=?").bind(id),
      db.prepare(`SELECT COUNT(*) recorded_result_count,
        COALESCE(SUM(CASE WHEN r.distance_unit='metres' AND r.event_kind='individual' AND r.result_status IS NULL AND r.time_microseconds>0 THEN 1 ELSE 0 END),0) comparable_result_count,
        COUNT(DISTINCT c.season) season_count${recordJoin} WHERE ${participantRecordScope}`).bind(id,id),
      db.prepare(`WITH eligible AS (SELECT ${recordSelect},
        DENSE_RANK() OVER (PARTITION BY c.discipline,r.distance ORDER BY r.time_microseconds) best_order
        ${recordJoin} WHERE ${participantRecordScope} AND r.distance_unit='metres' AND r.event_kind='individual' AND r.result_status IS NULL AND r.time_microseconds>0)
        SELECT * FROM eligible WHERE best_order=1 ORDER BY discipline DESC,distance,starts_on DESC,competition_id,id`).bind(id,id),
    ]);
    if(!person.results.length)return Response.json({error:"Participant not found."},{status:404});
    const groups=new Map<string,{discipline:string;distance:number;time_microseconds:number;performances:Performance[]}>();
    for(const row of bests.results){
      const {best_order:_,...performance}=row;
      const r=performance as Performance,key=`${r.discipline}:${r.distance}`;
      const group=groups.get(key)??{discipline:r.discipline,distance:r.distance,time_microseconds:r.time_microseconds,performances:[]};
      group.performances.push(r);groups.set(key,group);
    }
    return Response.json({participantId:id,identityStatus:person.results[0].identity_status,basis:"published-results",seasonScope:"all-published-seasons",coverage:coverage.results[0],personalBests:[...groups.values()]},{headers:{"Cache-Control":"no-store"}});
  }catch(error){return unavailable(error);}
}
