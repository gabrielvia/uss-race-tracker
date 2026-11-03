import { database, unavailable } from "@/lib/database";
import { recordJoin, recordScope, recordSelect } from "@/lib/skater-records";
import { competitionBests, validDate, type PerformanceRecord } from "@/lib/performance";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const people = [...new Set(params.getAll("participant"))];
  const discipline = params.get("discipline"), distance = params.get("distance"), round = params.get("round");
  const from = params.get("from"), to = params.get("to");
  if (!people.length || people.length > 4 || people.some(id => !/^[a-z0-9-]{1,80}:[^:]{1,80}$/.test(id)) ||
      discipline !== null && !["short-track", "long-track"].includes(discipline) ||
      distance !== null && !/^[1-9]\d{0,5}$/.test(distance) ||
      round !== null && (!round.trim() || round.length > 100) ||
      from !== null && !validDate(from) || to !== null && !validDate(to) || from && to && from > to) {
    return Response.json({error: "Choose one to four participants and valid discipline, distance, round and date filters."}, {status: 400});
  }
  // The first requested member represents each already-reviewed identity.
  // Selection never changes links, pending-review isolation or age evidence.
  const selected = `WITH requested AS (
    SELECT p.id,p.name,COALESCE(l.status,'unlinked') identity_status,CAST(j.key AS INTEGER) selection_order,
      CASE WHEN l.status IS NOT NULL AND l.status!='needs_review' THEN 'skater:'||l.skater_id ELSE 'participant:'||p.id END identity_key
    FROM json_each(?) j JOIN participants p ON p.id=j.value LEFT JOIN skater_links l ON l.participant_key=p.id
  ), numbered AS (SELECT *,ROW_NUMBER() OVER (PARTITION BY identity_key ORDER BY selection_order) identity_order FROM requested),
  selected AS (SELECT * FROM numbered WHERE identity_order=1) `;
  const join = recordJoin + ` JOIN selected ON ${recordScope("selected.id")}`;
  const args: (string | number)[] = [JSON.stringify(people)], clauses: string[] = [];
  if (discipline) { clauses.push("c.discipline=?"); args.push(discipline); }
  if (distance) { clauses.push("r.distance=?"); args.push(Number(distance)); }
  // Legacy round parameters do not narrow a whole-competition best.
  // Inclusive overlap with the evidenced competition range; not a race date.
  if (from) { clauses.push("c.ends_on>=?"); args.push(from); }
  if (to) { clauses.push("c.starts_on<=?"); args.push(to); }
  const selectionRequired = !discipline || !distance;
  try {
    const db = database();
    const [exists, series, options, records] = await db.batch<Record<string, unknown>>([
      db.prepare("SELECT id FROM participants WHERE id IN (SELECT value FROM json_each(?))").bind(JSON.stringify(people)),
      db.prepare(selected + "SELECT id,name,identity_status FROM selected ORDER BY selection_order").bind(JSON.stringify(people)),
      db.prepare(selected + "SELECT DISTINCT c.discipline,r.distance,r.round" + join + " ORDER BY c.discipline DESC,r.distance,r.round").bind(JSON.stringify(people)),
      db.prepare(selected + "SELECT selected.id series_id," + recordSelect + join + " WHERE " + (selectionRequired ? "0" : clauses.join(" AND ")) + " ORDER BY c.starts_on,c.id,r.event_key,r.race_id,r.id").bind(...(selectionRequired ? [JSON.stringify(people)] : args)),
    ]);
    if (exists.results.length !== people.length) return Response.json({error: "Participant not found."}, {status: 404});
    return Response.json({query: params.toString(), selectionRequired, series: series.results, options: options.results, records: records.results, competitionBests: competitionBests(records.results as PerformanceRecord[]), trackSpecification: null}, {headers: {"Cache-Control": "no-store"}});
  } catch (error) { return unavailable(error); }
}
