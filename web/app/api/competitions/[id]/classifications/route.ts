import { COMPETITION_ID } from "@/lib/competition-id";
import { database,unavailable } from "@/lib/database";
export const dynamic="force-dynamic";
export async function GET(_request:Request,context:{params:Promise<{id:string}>}){
 const {id}=await context.params;if(!COMPETITION_ID.test(id))return Response.json({error:"Competition not found."},{status:404});
 try{
  const {results}=await database().prepare("SELECT c.source_page,c.kind,c.label,c.text_raw,c.rows_json FROM classification_pages c JOIN import_publications p ON p.batch_id=c.batch_id AND p.competition_id=c.competition_id WHERE c.competition_id=? ORDER BY c.source_page").bind(id).all<Record<string,unknown>>();
  return Response.json({competitionId:id,interpretation:"Original classification pages, separate from race results. Raw columns and official places are preserved; no classification is recomputed from times.",pages:results.map(p=>({...p,rows:JSON.parse(String(p.rows_json)),rows_json:undefined}))},{headers:{"Cache-Control":"no-store"}});
 }catch(error){return unavailable(error);}
}
