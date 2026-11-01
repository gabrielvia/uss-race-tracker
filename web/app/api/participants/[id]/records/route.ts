import { database, unavailable } from "@/lib/database";
import { participantRecordScope, recordJoin, recordSelect } from "@/lib/skater-records";
export const dynamic="force-dynamic";
export async function GET(request:Request,context:{params:Promise<{id:string}>}) {
  const {id}=await context.params,p=new URL(request.url).searchParams;
  const discipline=p.get("discipline"),season=p.get("season"),page=p.get("page")??"1";
  if(!/^[a-z0-9-]{1,80}:[^:]{1,80}$/.test(id))return Response.json({error:"Participant not found."},{status:404});
  if(discipline!==null&&!['short-track','long-track'].includes(discipline)||season!==null&&(!/^20\d{2}-20\d{2}$/.test(season)||Number(season.slice(5))!==Number(season.slice(0,4))+1)||!/^[1-9]\d{0,4}$/.test(page))return Response.json({error:"Use valid history filters and a positive page."},{status:400});
  const scope=participantRecordScope;
  const selectionRequired=false;
  const clauses=[scope],args:(string|number)[]=[id,id];
  if(discipline){clauses.push("c.discipline=?");args.push(discipline);}
  if(season){clauses.push("c.season=?");args.push(season);}
  const join=recordJoin;
  try {
    const db=database();
    const [person,count,rows,scopes]=await db.batch<Record<string,unknown>>([
      db.prepare("SELECT id FROM participants WHERE id=?").bind(id),
      db.prepare("SELECT COUNT(*) total"+join+" WHERE "+clauses.join(" AND ")).bind(...args),
      db.prepare("SELECT "+recordSelect+join+" WHERE "+clauses.join(" AND ")+" ORDER BY c.starts_on DESC,c.id,CAST(e.source_event_number AS INTEGER),e.label,r.race_id,r.rank,r.id LIMIT 50 OFFSET ?").bind(...args,(Number(page)-1)*50),
      db.prepare("SELECT DISTINCT c.discipline,c.season"+join+" WHERE "+scope+" ORDER BY c.discipline,c.season DESC").bind(id,id),
    ]);
    if(!person.results.length)return Response.json({error:"Participant not found."},{status:404});
    return Response.json({participantId:id,selectionRequired,scope:{discipline,season},results:rows.results,total:count.results[0]?.total??0,page:Number(page),pageSize:50,scopes:scopes.results},{headers:{"Cache-Control":"no-store"}});
  }catch(error){return unavailable(error);}
}
