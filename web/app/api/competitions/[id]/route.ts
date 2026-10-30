import { COMPETITION_ID } from "@/lib/competition-id";
import { database, unavailable } from "@/lib/database";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!COMPETITION_ID.test(id)) return Response.json({ error: "Competition not found." }, { status: 404 });
  try {
    const db = database();
    // All detail records share one D1 read transaction, including source metadata.
    const [metadata, participants, entries, results] = await db.batch([
      db.prepare("SELECT c.*, s.url AS source_url FROM competitions c JOIN sources s ON s.id = c.source_id WHERE c.id = ?").bind(id),
      db.prepare("SELECT id, bib, name, affiliation FROM participants WHERE competition_id = ? ORDER BY name COLLATE NOCASE").bind(id),
      db.prepare("SELECT e.* FROM entries e JOIN participants p ON p.id = e.participant_id WHERE p.competition_id = ? ORDER BY e.id").bind(id),
      db.prepare("SELECT * FROM results WHERE competition_id = ? ORDER BY event_key, (result_status IS NOT NULL OR time_microseconds IS NULL), time_microseconds, race_id, rank").bind(id),
    ]);
    const competition = metadata.results[0];
    if (!competition) return Response.json({ error: "Competition not found." }, { status: 404 });
    return Response.json({ competition, participants: participants.results, entries: entries.results, results: results.results }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return unavailable(error); }
}
