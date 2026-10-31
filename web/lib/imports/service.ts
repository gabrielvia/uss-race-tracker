import { previewAgeConstraints } from "@/lib/imports/age-preview";
import { bulkInsert } from "@/lib/imports/bulk";
import { COMPETITION_ID } from "@/lib/competition-id";
import { eventDefinitions } from "@/lib/imports/events";
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
  const { report, payload } = validate(value);
  if(report.valid&&payload){
    report.ageChecks=await previewAgeConstraints(payload);
    if(report.ageChecks.conflicts.length)report.warnings.push({code:"AGE_EVIDENCE_CONFLICT",path:"item.evidence.roster",message:"Reviewed linked age evidence conflicts. Retain valid race results, quarantine the numeric age, and review the identity/rules."});
    if(report.ageChecks.identityReview.length)report.warnings.push({code:"IDENTITY_REVIEW_REQUIRED",path:"item.participants",message:"Changed source identities require explicit review before being used for a combined profile or age."});
    if(report.ageChecks.unresolvedCategories.length)report.warnings.push({code:"AGE_RULE_UNREVIEWED",path:"item.evidence.roster",message:"Some age categories have no reviewed matching rule; they will not establish a numerical age."});
  }
  const possibleId = (value as {item?: {competition?: {id?: unknown}}} | null)?.item?.competition?.id;
  const competitionId = typeof possibleId === "string" && COMPETITION_ID.test(possibleId) ? possibleId : null;
  const key = `imports/candidates/${id}.json`;
  await bucket().put(key, canonical(value), { httpMetadata: { contentType: "application/json" } });
  await database().batch([database().prepare("INSERT INTO import_batches (id, candidate_key, competition_id, status, report_json, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING")
    .bind(id, key, competitionId, report.valid ? "validated" : "rejected", JSON.stringify(report), new Date().toISOString())]);
  const batch = await getBatch(id);
  if (!batch) throw new Error("The submitted batch was not stored.");
  return describe(batch);
}
export async function head(competitionId: string) {
  return database().prepare("SELECT batch_id FROM import_publications WHERE competition_id = ?").bind(competitionId).first<{ batch_id: string }>();
}
async function legacyRevisionStatements(competitionId:string, current:string|null):Promise<D1PreparedStatement[]> {
  const db=database(), statements:D1PreparedStatement[]=[],seen=new Set<string>();
  while(current) {
    if(seen.has(current)||seen.size>=64) throw new ImportConflict("The prior publication lineage needs review before another correction.");
    seen.add(current);
    if(await db.prepare("SELECT batch_id FROM publication_revisions WHERE batch_id=?").bind(current).first()) break;
    const old=await getBatch(current),object=old?await bucket().get(old.candidate_key):null;
    if(!old||!object) throw new Error("Prior publication evidence is unavailable.");
    const value=JSON.parse(await object.text()),version=JSON.parse(old.report_json).validationVersion;
    if(hash(`${version}\n${canonical(value)}`)!==old.id||value.item?.competition?.id!==competitionId) throw new Error("Prior publication integrity check failed.");
    statements.push(db.prepare("INSERT INTO publication_revisions (batch_id,competition_id,previous_batch_id,source_id,source_hash,season_label,reviewer,notes,metadata_json,published_at) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(batch_id) DO NOTHING").bind(old.id,competitionId,value.baseBatchId,value.item.source.id,value.item.source.sha256,value.review.seasonSourceLabel,value.review.reviewer,value.review.notes,canonical(value.item.competition),old.published_at??old.created_at));
    statements.push(db.prepare("UPDATE import_batches SET competition_id=? WHERE id=? AND competition_id IS NULL").bind(competitionId,old.id));
    current=value.baseBatchId;
  }
  return statements;
}
function writeStatements(payload: ImportPayload, sourceId: string, objectKey: string, batchId: string): D1PreparedStatement[] {
  const db = database();
  const { competition: c, source, participants, entries, results } = payload.item;
  const now = new Date().toISOString();
  const events = eventDefinitions(payload.item);
  const evidenceEvents = "events" in payload.item.evidence ? payload.item.evidence.events : [payload.item.evidence.race];
  const participantMap = new Map(participants.map(p => [p.id, p]));
  const raceRows = evidenceEvents.flatMap(event => event.heats.map(heat => ({
    id: `${c.id}:${heat.race_id}`, competition_id: c.id, event_key: hash(`${c.id}|${event.event_label_raw}`).slice(0, 20),
    source_race_id: heat.race_id, label: heat.label, heat_number: heat.heat_number, heat_total: heat.heat_total,
    final_tier: /^([A-Z]) Final Race #\d+$/.exec(heat.label)?.[1] ?? null,
    source_page: event.results.find(r => r.race_id === heat.race_id)!.source_page,
  })));
  const protocol = "protocol" in payload.item ? payload.item.protocol : undefined;
  return [
    ...["results", "races", "competition_events"].map(table => db.prepare(`DELETE FROM ${table} WHERE competition_id = ?`).bind(c.id)),
    db.prepare("DELETE FROM entries WHERE participant_id IN (SELECT id FROM participants WHERE competition_id = ?)").bind(c.id),
    db.prepare("DELETE FROM participants WHERE competition_id = ?").bind(c.id),
    db.prepare("DELETE FROM competitions WHERE id = ?").bind(c.id),
    db.prepare("INSERT INTO sources (id, url, sha256, object_key) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO NOTHING").bind(sourceId, source.url, source.sha256, objectKey),
    db.prepare("INSERT INTO competitions (id, title, discipline, season, starts_on, ends_on, location, source_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(c.id, c.title, c.discipline, c.season, c.startsOn, c.endsOn, c.location, sourceId),
    ...bulkInsert(db, "competition_events", events.map(e => ({id: e.id, competition_id: c.id, source_event_number: e.sourceEventNumber, label: e.label, group_label: e.groupLabel, distance: e.distance, round: e.round}))),
    ...bulkInsert(db, "participants", participants.map(p => ({id: p.id, competition_id: c.id, bib: p.bib, name: p.name, affiliation: p.affiliation}))),
    ...bulkInsert(db, "entries", entries.map(e => ({id: e.id, participant_id: e.participantId, division: e.division, age_status: e.ageStatus, raw_name: e.rawName, source_page: e.sourcePage}))),
    ...bulkInsert(db, "races", raceRows),
    ...bulkInsert(db, "results", results.map(r => ({id: r.id, competition_id: c.id, participant_id: r.participantId, race_id: r.raceId, distance: r.distance, round: r.round, rank: r.rank, time_raw: r.timeRaw, time_microseconds: r.timeMicroseconds, qualification: r.qualification, source_page: r.sourcePage, event_key: r.eventKey, event_label: r.eventLabel, race_label: r.raceLabel, heat_number: r.heatNumber, heat_total: r.heatTotal, result_status: r.status, finish_note: r.finishNote ?? null}))),
    ...bulkInsert(db, "skaters", participants.map(p => ({id: hash(`competition-skater|${p.id}`).slice(0,20), display_name: p.name, created_at: now})), "ON CONFLICT(id) DO NOTHING"),
    ...bulkInsert(db, "skater_links", participants.map(p => ({participant_key: p.id, competition_id: c.id, bib: p.bib, skater_id: hash(`competition-skater|${p.id}`).slice(0,20), name: p.name, affiliation: p.affiliation, status: "competition-local", revision: batchId})), "ON CONFLICT(participant_key) DO UPDATE SET status = CASE WHEN skater_links.name = excluded.name AND skater_links.affiliation = excluded.affiliation THEN skater_links.status ELSE 'needs_review' END"),
    ...bulkInsert(db, "skater_aliases", entries.map(e => ({id: `${batchId}:${e.id}`, participant_key: e.participantId, batch_id: batchId, raw_name: e.rawName, name: participantMap.get(e.participantId)!.name, source_page: e.sourcePage}))),
    ...bulkInsert(db, "skater_observations", entries.map(e => ({id: `${batchId}:${e.id}`, participant_key: e.participantId, batch_id: batchId, competition_id: c.id, competed_on: c.startsOn, season: c.season, affiliation: participantMap.get(e.participantId)!.affiliation, age_category: e.ageStatus, division: e.division, raw_name: e.rawName, source_hash: source.sha256, source_page: e.sourcePage}))),
    ...bulkInsert(db, "classification_pages", (protocol?.classifications ?? []).map(p => ({id: `${batchId}:${p.page}`, batch_id: batchId, competition_id: c.id, source_page: p.page, kind: p.kind, label: p.label, text_raw: p.text_raw, rows_json: JSON.stringify(p.rows)}))),
    db.prepare("INSERT INTO publication_revisions (batch_id, competition_id, previous_batch_id, source_id, source_hash, season_label, reviewer, notes, metadata_json, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(batchId, c.id, payload.baseBatchId, source.id, source.sha256, payload.review.seasonSourceLabel, payload.review.reviewer, payload.review.notes, canonical({...c, resultsCoverage: protocol ? "protocol-results" : "selected-events", classificationPages: protocol?.classifications.length ?? 0}), now),
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
  if ("protocol" in payload.item && payload.item.protocol) {
    const document = await database().prepare("SELECT object_key, url FROM source_documents WHERE sha256 = ?").bind(payload.item.source.sha256).first<{object_key:string;url:string}>();
    if (!document || document.url !== payload.item.source.url || !await bucket().head(document.object_key)) throw new ImportConflict("Archive the matching original PDF before publishing a full protocol.");
  }
  const competitionId = payload.item.competition.id;
  const current = (await head(competitionId))?.batch_id ?? null;
  if (current === batch.id) return { id: batch.id, status: "published", competitionId, active: true };
  if (batch.status !== "validated" || current !== payload.baseBatchId) throw new ImportConflict("The published competition has changed. Review it and submit a new batch with its current baseBatchId.");
  const keys = eventDefinitions(payload.item).map(e => e.id);
  const removed = payload.review.reconciliation?.removedEventKeys ?? [];
  if (removed.some(k=>keys.includes(k))) throw new ImportConflict("A reconciled event cannot also remain in the replacement candidate.");
  const allowedKeys = [...keys,...removed];
  const coverageQuery = "SELECT DISTINCT event_key FROM results WHERE competition_id = ? AND (event_key IS NULL OR event_key NOT IN (SELECT value FROM json_each(?)))";
  const removalQuery = removed.length ? "SELECT COUNT(DISTINCT event_key) count FROM results WHERE competition_id = ? AND event_key IN (SELECT value FROM json_each(?))" : null;
  if (removalQuery) {
    const found = await database().prepare(removalQuery).bind(competitionId,JSON.stringify(removed)).first<{count:number}>();
    if (found?.count !== removed.length) throw new ImportConflict("Every explicitly reconciled key must identify a currently published event.");
  }
  const missing = await database().prepare(coverageQuery).bind(competitionId, JSON.stringify(allowedKeys)).all();
  if (missing.results.length) throw new ImportConflict("This candidate omits previously published events. Include every current event before publishing an expanded competition.");
  const evidence = canonical({ ...payload.item.evidence, ...("protocol" in payload.item && payload.item.protocol ? { protocol: payload.item.protocol } : {}) });
  const evidenceHash = hash(evidence);
  const sourceId = hash(`${payload.item.source.id}|${payload.item.source.sha256}|${evidenceHash}`).slice(0, 16);
  const objectKey = `imports/evidence/${evidenceHash}.json`;
  // R2 is outside the SQL transaction. Only immutable objects are uploaded first.
  await bucket().put(objectKey, evidence, { httpMetadata: { contentType: "application/json" } });
  const db = database();
  const legacy = await legacyRevisionStatements(competitionId,current);
  const statements = [
    // CHECK failures roll back every statement. This condition is evaluated inside
    // the transaction, so two concurrent revisions cannot silently overwrite.
    db.prepare("INSERT INTO import_assertions (value) SELECT CASE WHEN (SELECT status FROM import_batches WHERE id = ?) = 'validated' AND (SELECT batch_id FROM import_publications WHERE competition_id = ?) IS ? AND NOT EXISTS (SELECT 1 FROM sources WHERE id = ? AND (url != ? OR sha256 != ? OR object_key != ?)) THEN 1 ELSE 0 END")
      .bind(batch.id, competitionId, payload.baseBatchId, sourceId, payload.item.source.url, payload.item.source.sha256, objectKey),
    db.prepare("INSERT INTO import_assertions (value) SELECT CASE WHEN NOT EXISTS (" + coverageQuery + ") THEN 1 ELSE 0 END").bind(competitionId, JSON.stringify(allowedKeys)),
    ...(removalQuery ? [db.prepare("INSERT INTO import_assertions (value) SELECT CASE WHEN ("+removalQuery+") = ? THEN 1 ELSE 0 END").bind(competitionId,JSON.stringify(removed),removed.length)] : []),
    ...legacy,
    ...writeStatements(payload, sourceId, objectKey, batch.id),
    db.prepare("INSERT INTO import_publications (competition_id, batch_id) VALUES (?, ?) ON CONFLICT(competition_id) DO UPDATE SET batch_id = excluded.batch_id").bind(competitionId, batch.id),
    db.prepare("UPDATE import_batches SET status = 'published', published_at = ? WHERE id = ?").bind(new Date().toISOString(), batch.id),
    db.prepare("DELETE FROM import_assertions"),
  ];
  try { await db.batch(statements); }
  catch (error) {
    const after = (await head(competitionId))?.batch_id ?? null;
    if (after === batch.id) return { id: batch.id, status: "published", competitionId, active: true };
    if (after !== payload.baseBatchId) throw new ImportConflict("Another revision was published first. Review the current competition before retrying.");
    const omitted = await db.prepare(coverageQuery).bind(competitionId, JSON.stringify(allowedKeys)).all();
    if (omitted.results.length) throw new ImportConflict("The published event coverage changed. Include every current event before retrying.");
    throw error;
  }
  return { id: batch.id, status: "published", competitionId, active: true };
}
