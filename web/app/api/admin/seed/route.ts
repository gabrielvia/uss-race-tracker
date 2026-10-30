import { env } from "cloudflare:workers";
import { createHash, timingSafeEqual } from "node:crypto";
import { bucket, database, unavailable } from "@/lib/database";
import sample from "@/lib/sample-data.json";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const expected = env.SEED_TOKEN;
  const supplied = request.headers.get("Authorization")?.replace(/^Bearer /, "") ?? "";
  const suppliedBytes = Buffer.from(supplied);
  const expectedBytes = Buffer.from(expected ?? "");
  if (!expected || suppliedBytes.length !== expectedBytes.length || !timingSafeEqual(suppliedBytes, expectedBytes)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    const db = database();
    const hasPublication = await db.prepare("SELECT batch_id FROM import_publications LIMIT 1").first();
    if (hasPublication) return Response.json({ error: "Bootstrap is disabled after validated publication." }, { status: 409 });
    const statements: D1PreparedStatement[] = [db.prepare("INSERT INTO import_assertions (value) SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM import_publications) THEN 1 ELSE 0 END")];
    for (const item of sample.competitions) {
      const { source, competition: c } = item;
      const existing = await db.prepare("SELECT sha256 FROM sources WHERE id = ?").bind(source.id).first<{ sha256: string }>();
      if (existing && existing.sha256 !== source.sha256) return Response.json({ error: "This source has changed. Reconcile its existing records before importing a new revision." }, { status: 409 });
      const evidence = JSON.stringify(item.evidence);
      const evidenceHash = createHash("sha256").update(evidence).digest("hex");
      const objectKey = `samples/${source.sha256}/${evidenceHash}.json`;
      // Upload immutable evidence first; database references change only on commit.
      await bucket().put(objectKey, evidence, { httpMetadata: { contentType: "application/json" } });
      statements.push(
        db.prepare("INSERT INTO sources (id, url, sha256, object_key) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET object_key = excluded.object_key").bind(source.id, source.url, source.sha256, objectKey),
        db.prepare("INSERT INTO competitions (id, title, discipline, season, starts_on, ends_on, location, source_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING").bind(c.id, c.title, c.discipline, c.season, c.startsOn, c.endsOn, c.location, source.id),
        ...item.participants.map(p => db.prepare("INSERT INTO participants (id, competition_id, bib, name, affiliation) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING").bind(p.id, c.id, p.bib, p.name, p.affiliation)),
        ...item.entries.map(e => db.prepare("INSERT INTO entries (id, participant_id, division, age_status, raw_name, source_page) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING").bind(e.id, e.participantId, e.division, e.ageStatus, e.rawName, e.sourcePage)),
        ...item.results.map(r => db.prepare("INSERT INTO results (id, competition_id, participant_id, race_id, distance, round, rank, time_raw, time_microseconds, qualification, source_page, event_key, event_label, race_label, heat_number, heat_total, result_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET event_key = excluded.event_key, event_label = excluded.event_label, race_label = excluded.race_label, heat_number = excluded.heat_number, heat_total = excluded.heat_total, result_status = excluded.result_status").bind(r.id, c.id, r.participantId, r.raceId, r.distance, r.round, r.rank, r.timeRaw, r.timeMicroseconds, r.qualification, r.sourcePage, r.eventKey, r.eventLabel, r.raceLabel, r.heatNumber, r.heatTotal, r.status)),
      );
    }
    // D1 executes a single batch as one transaction: any SQL failure rolls it back.
    statements.push(db.prepare("DELETE FROM import_assertions"));
    await db.batch(statements);
    return Response.json({ seeded: true, competitionCount: sample.competitions.length });
  } catch (error) { return unavailable(error); }
}
