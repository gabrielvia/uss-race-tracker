import { COMPETITION_ID } from "@/lib/competition-id";
import { bucket, database, unavailable } from "@/lib/database";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: {params: Promise<{id: string}>}) {
  const {id} = await context.params;
  if (!COMPETITION_ID.test(id)) return Response.json({error: "Competition not found."}, {status: 404});
  const expected = new URL(request.url).searchParams.get("source");
  if (expected !== null && !/^[a-f0-9]{16}$/.test(expected)) return Response.json({error: "Use a valid source revision."}, {status: 400});
  try {
    // The selected evidence revision is immutable, including during a later publication.
    const source = await database().prepare(`SELECT s.id,s.object_key,s.sha256 FROM competitions c JOIN sources s ON s.id=c.source_id
      JOIN import_publications p ON p.competition_id=c.id WHERE c.id=?`).bind(id).first<{id: string; object_key: string; sha256: string}>();
    if (!source) return Response.json({error: "Competition not found."}, {status: 404});
    if (expected !== null && expected !== source.id) return Response.json({error: "The source revision changed. Refresh the competition before opening its tables."}, {status: 409});
    const object = await bucket().get(source.object_key);
    if (!object) throw new Error("Source evidence is unavailable.");
    const evidence = JSON.parse(await object.text());
    return Response.json({competitionId: id, sourceHash: source.sha256,
      interpretation: "Original standings and other source tables are retained separately from individual results and personal bests.",
      pages: evidence.protocol?.supplementary_pages ?? []}, {headers: {"Cache-Control": "no-store"}});
  } catch (error) { return unavailable(error); }
}
