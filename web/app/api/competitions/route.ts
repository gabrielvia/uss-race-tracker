import { database, unavailable } from "@/lib/database";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const { results } = await database().prepare(`SELECT c.*, s.url AS source_url,
      (SELECT COUNT(*) FROM participants p WHERE p.competition_id = c.id) AS participant_count,
      (SELECT COUNT(*) FROM results r WHERE r.competition_id = c.id) AS result_count,
      (SELECT COUNT(DISTINCT r.event_key) FROM results r WHERE r.competition_id = c.id) AS event_count
      FROM competitions c JOIN sources s ON s.id = c.source_id ORDER BY c.starts_on DESC`).all();
    return Response.json({ competitions: results }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return unavailable(error); }
}
