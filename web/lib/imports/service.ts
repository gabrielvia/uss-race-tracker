import { bucket, database } from "@/lib/database";
import { candidateId, canonical, hash, validate, VALIDATION_VERSION, type ImportPayload, type ValidationReport } from "@/lib/imports/validation";

export type Batch = { id: string; candidate_key: string; status: string; report_json: string; created_at: string; published_at: string | null };
export class ImportConflict extends Error {}
export async function getBatch(id: string): Promise<Batch | null> {
  return database().prepare("SELECT * FROM import_batches WHERE id = ?").bind(id).first<Batch>();
}
export function describe(batch: Batch) {
  return { id: batch.id, status: batch.status, createdAt: batch.created_at, publishedAt: batch.published_at, report: JSON.parse(batch.report_json) as ValidationReport };
}
export async function submit(value: unknown) {
  const id = candidateId(value);
  const existing = await getBatch(id);
  if (existing) return describe(existing);
  const { report } = validate(value);
  const key = `imports/candidates/${id}.json`;
  await bucket().put(key, canonical(value), { httpMetadata: { contentType: "application/json" } });
  await database().batch([database().prepare("INSERT INTO import_batches (id, candidate_key, status, report_json, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING")
    .bind(id, key, report.valid ? "validated" : "rejected", JSON.stringify(report), new Date().toISOString())]);
  const batch = await getBatch(id);
  if (!batch) throw new Error("The submitted batch was not stored.");
  return describe(batch);
}
export async function head(competitionId: string) {
  return database().prepare("SELECT batch_id FROM import_publications WHERE competition_id = ?").bind(competitionId).first<{ batch_id: string }>();
}
function writeStatements(payload: ImportPayload, sourceId: string, objectKey: string): D1PreparedStatement[] {
  const db = database();
  const { competition: c, source, participants, entries, results } = payload.item;
  return [
    db.prepare("DELETE FROM results WHERE competition_id = ?").bind(c.id),
    db.prepare("DELETE FROM entries WHERE participant_id IN (SELECT id FROM participants WHERE competition_id = ?)").bind(c.id),
    db.prepare("DELETE FROM participants WHERE competition_id = ?").bind(c.id),
    db.prepare("DELETE FROM competitions WHERE id = ?").bind(c.id),
    db.prepare("INSERT INTO sources (id, url, sha256, object_key) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO NOTHING").bind(sourceId, source.url, source.sha256, objectKey),
    db.prepare("INSERT INTO competitions (id, title, discipline, season, starts_on, ends_on, location, source_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(c.id, c.title, c.discipline, c.season, c.startsOn, c.endsOn, c.location, sourceId),
    ...participants.map(p => db.prepare("INSERT INTO participants (id, competition_id, bib, name, affiliation) VALUES (?, ?, ?, ?, ?)").bind(p.id, c.id, p.bib, p.name, p.affiliation)),
    ...entries.map(e => db.prepare("INSERT INTO entries (id, participant_id, division, age_status, raw_name, source_page) VALUES (?, ?, ?, ?, ?, ?)").bind(e.id, e.participantId, e.division, e.ageStatus, e.rawName, e.sourcePage)),
    ...results.map(r => db.prepare("INSERT INTO results (id, competition_id, participant_id, race_id, distance, round, rank, time_raw, time_microseconds, qualification, source_page, event_key, event_label, race_label, heat_number, heat_total, result_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(r.id, c.id, r.participantId, r.raceId, r.distance, r.round, r.rank, r.timeRaw, r.timeMicroseconds, r.qualification, r.sourcePage, r.eventKey, r.eventLabel, r.raceLabel, r.heatNumber, r.heatTotal, r.status)),
  ];
}
export async function publish(batch: Batch) {
  const report: ValidationReport = JSON.parse(batch.report_json);
  if (!report.valid || report.validationVersion !== VALIDATION_VERSION) throw new ImportConflict("This batch must pass the current validation before publication.");
  const object = await bucket().get(batch.candidate_key);
  if (!object) throw new Error("The candidate file is unavailable.");
  const value: unknown = JSON.parse(await object.text());
  if (candidateId(value) !== batch.id) throw new Error("Candidate integrity check failed.");
  const checked = validate(value);
  if (!checked.report.valid || !checked.payload) throw new ImportConflict("Candidate validation failed. Submit a corrected batch.");
  const payload = checked.payload;
  const competitionId = payload.item.competition.id;
  const current = (await head(competitionId))?.batch_id ?? null;
  if (current === batch.id) return { id: batch.id, status: "published", competitionId, active: true };
  if (batch.status !== "validated" || current !== payload.baseBatchId) throw new ImportConflict("The published competition has changed. Review it and submit a new batch with its current baseBatchId.");
  const evidence = canonical(payload.item.evidence);
  const evidenceHash = hash(evidence);
  const sourceId = hash(`${payload.item.source.id}|${payload.item.source.sha256}|${evidenceHash}`).slice(0, 16);
  const objectKey = `imports/evidence/${evidenceHash}.json`;
  // R2 is outside the SQL transaction. Only immutable objects are uploaded first.
  await bucket().put(objectKey, evidence, { httpMetadata: { contentType: "application/json" } });
  const db = database();
  const statements = [
    // CHECK failures roll back every statement. This condition is evaluated inside
    // the transaction, so two concurrent revisions cannot silently overwrite.
    db.prepare("INSERT INTO import_assertions (value) SELECT CASE WHEN (SELECT status FROM import_batches WHERE id = ?) = 'validated' AND (SELECT batch_id FROM import_publications WHERE competition_id = ?) IS ? AND NOT EXISTS (SELECT 1 FROM sources WHERE id = ? AND (url != ? OR sha256 != ? OR object_key != ?)) THEN 1 ELSE 0 END")
      .bind(batch.id, competitionId, payload.baseBatchId, sourceId, payload.item.source.url, payload.item.source.sha256, objectKey),
    ...writeStatements(payload, sourceId, objectKey),
    db.prepare("INSERT INTO import_publications (competition_id, batch_id) VALUES (?, ?) ON CONFLICT(competition_id) DO UPDATE SET batch_id = excluded.batch_id").bind(competitionId, batch.id),
    db.prepare("UPDATE import_batches SET status = 'published', published_at = ? WHERE id = ?").bind(new Date().toISOString(), batch.id),
    db.prepare("DELETE FROM import_assertions"),
  ];
  try { await db.batch(statements); }
  catch (error) {
    const after = (await head(competitionId))?.batch_id ?? null;
    if (after === batch.id) return { id: batch.id, status: "published", competitionId, active: true };
    if (after !== payload.baseBatchId) throw new ImportConflict("Another revision was published first. Review the current competition before retrying.");
    throw error;
  }
  return { id: batch.id, status: "published", competitionId, active: true };
}
