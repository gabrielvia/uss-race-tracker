import { filterColumns, resultFilters, resultWhere, type ResultFilters } from "@/lib/browse-query";
import type { CompetitionEvent, RaceResult } from "@/lib/types";
import { COMPETITION_ID } from "@/lib/competition-id";
import { database, unavailable } from "@/lib/database";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!COMPETITION_ID.test(id)) return Response.json({ error: "Competition not found." }, { status: 404 });
  let filters: ResultFilters;
  try { filters=resultFilters(new URL(request.url).searchParams); }
  catch(error) { return Response.json({error:(error as Error).message},{status:400}); }
  try {
    const db = database(), where=resultWhere(id,filters);
    const join=" FROM results r LEFT JOIN competition_events e ON e.id=r.event_key";
    const facets=(Object.keys(filterColumns) as (keyof typeof filterColumns)[]).map(key=>{
      const scope=resultWhere(id,filters,key),column=filterColumns[key];
      const mixed=key==="gender"?" UNION ALL SELECT 'Mixed' value,COUNT(*) count"+join+scope.sql+" AND e.gender='Mixed' HAVING COUNT(*)>0":"";
      return db.prepare(`SELECT ${column} value,COUNT(*) count${join}${scope.sql} GROUP BY ${column}${mixed} ORDER BY value`).bind(...scope.bindings,...(key==="gender"?scope.bindings:[]));
    });
    // All detail records share one D1 read transaction, including source metadata.
    const [metadata, participants, entries, results, storedEvents, publication, ...options] = await db.batch<Record<string, unknown>>([
      db.prepare("SELECT c.*, s.url AS source_url, (SELECT COUNT(*) FROM results WHERE competition_id=c.id) result_count,(SELECT COUNT(*) FROM participants WHERE competition_id=c.id) participant_count,(SELECT COUNT(*) FROM competition_events WHERE competition_id=c.id) event_count FROM competitions c JOIN sources s ON s.id = c.source_id WHERE c.id = ?").bind(id),
      db.prepare("SELECT id, bib, name, affiliation FROM participants WHERE competition_id = ? ORDER BY name COLLATE NOCASE").bind(id),
      db.prepare("SELECT e.* FROM entries e JOIN participants p ON p.id = e.participant_id WHERE p.competition_id = ? ORDER BY e.id").bind(id),
      db.prepare("SELECT r.*"+join+where.sql+" ORDER BY r.event_key, (r.result_status IS NOT NULL OR r.time_microseconds IS NULL), r.time_microseconds, r.race_id, r.rank").bind(...where.bindings),
      db.prepare("SELECT * FROM competition_events WHERE competition_id = ?").bind(id),
      db.prepare("SELECT r.metadata_json,r.source_hash,d.object_key FROM publication_revisions r JOIN import_publications p ON p.batch_id=r.batch_id LEFT JOIN source_documents d ON d.sha256=r.source_hash WHERE p.competition_id=?").bind(id),
      ...facets,
    ]);
    const competition = metadata.results[0];
    if (!competition) return Response.json({ error: "Competition not found." }, { status: 404 });
    const rows = results.results as RaceResult[];
    const saved = new Map((storedEvents.results as { id: string; source_event_number: string; label: string; group_label: string; gender:string; division_key:string; competition_group:string|null; scope_status:string }[]).map(e => [e.id, e]));
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
      return { gender: event?.gender??"Unknown", division_key:event?.division_key??"Unknown", competition_group:event?.competition_group??null, scope_status:event?.scope_status??"needs-review", id: key, source_event_number: (event?.source_event_number as string | undefined) ?? /Event #(\d+)$/.exec(label)?.[1] ?? null,
        label: (event?.label as string | undefined) ?? label, group_label: (event?.group_label as string | undefined) ?? label.replace(/ \d+ (?:Quarter-Finals|Semi-Finals|Finals) Event #\d+$/, ""),
        distance: first.distance, round: first.round, result_count: group.length, heat_count: new Set(group.map(r => r.race_id)).size };
    }).sort((a, b) => Number(a.source_event_number ?? Infinity) - Number(b.source_event_number ?? Infinity) || a.label.localeCompare(b.label));
    const publicationMetadata = publication.results[0]?.metadata_json ? JSON.parse(String(publication.results[0].metadata_json)) : {};
    return Response.json({ competition, filters, matching:{results:rows.length,events:events.length,participants:new Set(rows.map(r=>r.participant_id)).size}, options:Object.fromEntries(Object.keys(filterColumns).map((key,i)=>[key,options[i].results])), events, coverage: { kind: publicationMetadata.resultsCoverage ?? "selected-events", eventCount: Number(competition.event_count), completeCompetition: false }, archivedPdf: publication.results[0]?.object_key ? `/api/documents/${publication.results[0].source_hash}` : null, classificationsUrl: `/api/competitions/${id}/classifications`, participants: participants.results, entries: entries.results, results: results.results }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return unavailable(error); }
}
