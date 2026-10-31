import { database,unavailable } from "@/lib/database";
export const dynamic="force-dynamic";
export async function GET(){
  try{
    const {results}=await database().prepare("SELECT discipline,season,COUNT(*) competition_count FROM competitions GROUP BY discipline,season ORDER BY discipline DESC,season DESC").all();
    return Response.json({scopes:results},{headers:{"Cache-Control":"no-store"}});
  }catch(error){return unavailable(error);}
}
