import { database, unavailable } from "@/lib/database";
import inventory from "@/lib/source-coverage.json";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { results } = await database().prepare(`SELECT c.id,c.discipline,c.season,s.url,s.sha256,b.published_at,
      (SELECT COUNT(*) FROM results r WHERE r.competition_id=c.id) result_count
      FROM competitions c JOIN sources s ON s.id=c.source_id
      JOIN import_publications p ON p.competition_id=c.id JOIN import_batches b ON b.id=p.batch_id
      ORDER BY c.discipline,c.season DESC,c.id`).all<{
        id: string; discipline: string; season: string; url: string; sha256: string; published_at: string; result_count: number;
      }>();
    const competitions = results.map(c => ({ ...c, auditStatus: inventory.reviews.find(r => r.url === c.url && r.sha256 === c.sha256)?.status ?? "not-checked" }));
    return Response.json({ ...inventory, published: {
      competitionCount: competitions.length, resultCount: competitions.reduce((n,c) => n+c.result_count,0),
      seasons: [...new Set(competitions.map(c => c.season))].sort().reverse(),
      latestPublishedAt: competitions.map(c => c.published_at).sort().at(-1) ?? null, competitions,
    } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return unavailable(error); }
}
