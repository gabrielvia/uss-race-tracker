import { COMPETITION_ID } from "@/lib/competition-id";
import { database, unavailable } from "@/lib/database";
import { reconcileCompetitionIdentities } from "@/lib/imports/automatic-identity";
import { importAuthorized, unauthorized } from "@/lib/imports/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!importAuthorized(request)) return unauthorized();
  const competition = new URL(request.url).searchParams.get("competition");
  if (!competition || !COMPETITION_ID.test(competition)) return Response.json({error:"A competition ID is required."},{status:400});
  try {
    const published = await database().prepare("SELECT 1 FROM import_publications WHERE competition_id=?").bind(competition).first();
    if (!published) return Response.json({error:"Published competition not found."},{status:404});
    const decisions = await reconcileCompetitionIdentities(competition);
    return Response.json({competition,decisions},{headers:{"Cache-Control":"no-store"}});
  } catch (error) {
    return unavailable(error);
  }
}
