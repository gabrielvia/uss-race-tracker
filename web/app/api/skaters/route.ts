import { database, unavailable } from "@/lib/database";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const q = (p.get("q") ?? "").trim(), page = p.get("page") ?? "1";
  if (q.length > 200 || !/^[1-9]\d{0,4}$/.test(page)) {
    return Response.json({ error: "Use a search up to 200 characters and a positive page." }, { status: 400 });
  }
  const search = "%" + q.replace(/[\\%_]/g, "\\$&") + "%";
  const cte = `WITH records AS (
    SELECT p.*,c.discipline,c.season,
      CASE WHEN l.status='needs_review' THEN p.id ELSE COALESCE(l.skater_id,p.id) END identity_key,
      COALESCE(l.status,'unlinked') link_status
    FROM participants p JOIN competitions c ON c.id=p.competition_id
    LEFT JOIN skater_links l ON l.participant_key=p.id
  ), matches AS (
    SELECT r.* FROM records r
    WHERE r.name LIKE ? ESCAPE '\\' OR r.affiliation LIKE ? ESCAPE '\\' OR r.bib LIKE ? ESCAPE '\\'
      OR EXISTS(SELECT 1 FROM skater_aliases a JOIN import_publications pub ON pub.batch_id=a.batch_id
        WHERE a.participant_key=r.id AND a.raw_name LIKE ? ESCAPE '\\')
  )`;
  try {
    const db = database(), args = [search, search, search, search];
    const [count, rows] = await db.batch<Record<string, unknown>>([
      db.prepare(cte + " SELECT COUNT(DISTINCT identity_key) total FROM matches").bind(...args),
      // Keep the existing deterministic participant ID, then take its displayed
      // name from that same row. Identity review state covers all current members,
      // so searching only a local anchor does not hide its reviewed linkage.
      db.prepare(cte + `, identity_states AS (
        SELECT identity_key,CASE
          WHEN MAX(link_status='needs_review')=1 THEN 'needs_review'
          WHEN MAX(link_status='reviewed')=1 THEN 'reviewed'
          WHEN MAX(link_status='competition-local')=1 THEN 'competition-local'
          ELSE 'unlinked' END identity_status
        FROM records GROUP BY identity_key
      ), grouped AS (
        SELECT MIN(id) representative_id,identity_key,COUNT(DISTINCT competition_id) competition_count,
          GROUP_CONCAT(DISTINCT discipline) disciplines,GROUP_CONCAT(DISTINCT season) seasons
        FROM matches GROUP BY identity_key
      )
      SELECT r.id,g.identity_key,r.name,s.identity_status,g.competition_count,g.disciplines,g.seasons
      FROM grouped g JOIN matches r ON r.id=g.representative_id
      JOIN identity_states s ON s.identity_key=g.identity_key
      ORDER BY r.name COLLATE NOCASE,g.identity_key LIMIT 25 OFFSET ?`).bind(...args, (Number(page) - 1) * 25),
    ]);
    return Response.json({ skaters: rows.results, total: count.results[0]?.total ?? 0, page: Number(page), pageSize: 25, q }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return unavailable(error); }
}
