import { database, unavailable } from "@/lib/database";
export const dynamic = "force-dynamic";
const select = `SELECT c.*, s.url AS source_url,
 (SELECT COUNT(*) FROM participants p WHERE p.competition_id=c.id) participant_count,
 (SELECT COUNT(*) FROM results r WHERE r.competition_id=c.id) result_count,
 (SELECT COUNT(DISTINCT event_key) FROM results r WHERE r.competition_id=c.id) event_count
 FROM competitions c JOIN sources s ON s.id=c.source_id`;
export async function GET(request:Request) {
  try {
    const db=database(), p=new URL(request.url).searchParams;
    if(!p.size){const {results}=await db.prepare(select+" ORDER BY c.starts_on DESC,c.id").all();return Response.json({competitions:results},{headers:{"Cache-Control":"no-store"}});}
    const discipline=p.get("discipline"),season=p.get("season"),query=(p.get("q")??"").trim(),page=p.get("page")??"1";
    if(!["short-track","long-track"].includes(discipline??"")||!/^20\d{2}-20\d{2}$/.test(season??"")||Number(season?.slice(5))!==Number(season?.slice(0,4))+1||query.length>200||!/^[1-9]\d{0,4}$/.test(page))return Response.json({error:"Select a discipline and consecutive-year season, with a positive page and search up to 200 characters."},{status:400});
    const where=" WHERE c.discipline=? AND c.season=? AND (c.title LIKE ? ESCAPE '\\' OR c.location LIKE ? ESCAPE '\\')";
    const search="%"+query.replace(/[\\%_]/g,"\\$&")+"%",params=[discipline,season,search,search];
    const [count,rows]=await db.batch<Record<string, unknown>>([db.prepare("SELECT COUNT(*) total FROM competitions c"+where).bind(...params),db.prepare(select+where+" ORDER BY c.starts_on DESC,c.id LIMIT 25 OFFSET ?").bind(...params,(Number(page)-1)*25)]);
    return Response.json({competitions:rows.results,scope:{discipline,season,q:query},page:Number(page),pageSize:25,total:count.results[0]?.total??0},{headers:{"Cache-Control":"no-store"}});
  } catch(error){return unavailable(error);}
}
