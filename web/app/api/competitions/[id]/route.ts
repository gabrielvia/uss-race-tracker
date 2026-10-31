import type { CompetitionEvent, RaceResult } from "@/lib/types";
import { COMPETITION_ID } from "@/lib/competition-id";
import { database, unavailable } from "@/lib/database";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!COMPETITION_ID.test(id)) return Response.json({ error: "Competition not found." }, { status: 404 });
  try {
    const db = database();
    // All detail records share one D1 read transaction, including source metadata.
    const [metadata, participants, entries, results, storedEvents, publication] = await db.batch<Record<string, unknown>>([
      db.prepare("SELECT c.*, s.url AS source_url FROM competitions c JOIN sources s ON s.id = c.source_id WHERE c.id = ?").bind(id),
      db.prepare("SELECT id, bib, name, affiliation FROM participants WHERE competition_id = ? ORDER BY name COLLATE NOCASE").bind(id),
      db.prepare("SELECT e.* FROM entries e JOIN participants p ON p.id = e.participant_id WHERE p.competition_id = ? ORDER BY e.id").bind(id),
      db.prepare("SELECT * FROM results WHERE competition_id = ? ORDER BY event_key, (result_status IS NOT NULL OR time_microseconds IS NULL), time_microseconds, race_id, rank").bind(id),
      db.prepare("SELECT * FROM competition_events WHERE competition_id = ?").bind(id),
      db.prepare("SELECT r.metadata_json,r.source_hash,d.object_key FROM publication_revisions r JOIN import_publications p ON p.batch_id=r.batch_id LEFT JOIN source_documents d ON d.sha256=r.source_hash WHERE p.competition_id=?").bind(id),
    ]);
    const competition = metadata.results[0];
    if (!competition) return Response.json({ error: "Competition not found." }, { status: 404 });
    const rows = results.results as RaceResult[];
    const saved = new Map((storedEvents.results as { id: string; source_event_number: string; label: string; group_label: string }[]).map(e => [e.id, e]));
    const groups = new Map<string, RaceResult[]>();
    for (const row of rows) {
      if (!row.event_key) continue;
      const group = groups.get(row.event_key) ?? []; group.push(row); groups.set(row.event_key, group);
    }
    // Legacy publications predate the event table. Derive their event metadata
    // from the same result snapshot until their next validated publication.
    const events: CompetitionEvent[] = [...groups].map(([key, group]) => {
      const first = group[0], label = first.event_label ?? "Unlabelled source event";
      const event = saved.get(key);
      return { id: key, source_event_number: (event?.source_event_number as string | undefined) ?? /Event #(\d+)$/.exec(label)?.[1] ?? null,
        label: (event?.label as string | undefined) ?? label, group_label: (event?.group_label as string | undefined) ?? label.replace(/ \d+ (?:Quarter-Finals|Semi-Finals|Finals) Event #\d+$/, ""),
        distance: first.distance, round: first.round, result_count: group.length, heat_count: new Set(group.map(r => r.race_id)).size };
    }).sort((a, b) => Number(a.source_event_number ?? Infinity) - Number(b.source_event_number ?? Infinity) || a.label.localeCompare(b.label));
    const publicationMetadata = publication.results[0]?.metadata_json ? JSON.parse(String(publication.results[0].metadata_json)) : {};
    return Response.json({ competition: { ...competition, event_count: events.length, participant_count: participants.results.length, result_count: rows.length }, events, coverage: { kind: publicationMetadata.resultsCoverage ?? "selected-events", eventCount: events.length, completeCompetition: false }, archivedPdf: publication.results[0]?.object_key ? `/api/documents/${publication.results[0].source_hash}` : null, classificationsUrl: `/api/competitions/${id}/classifications`, participants: participants.results, entries: entries.results, results: results.results }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return unavailable(error); }
}
