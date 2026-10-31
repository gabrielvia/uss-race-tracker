import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, index, uniqueIndex, check } from "drizzle-orm/sqlite-core";

export const sources = sqliteTable("sources", {
  id: text("id").primaryKey(), url: text("url").notNull(),
  sha256: text("sha256").notNull(), objectKey: text("object_key").notNull(),
});
export const competitions = sqliteTable("competitions", {
  id: text("id").primaryKey(), title: text("title").notNull(),
  discipline: text("discipline").notNull(), season: text("season").notNull(),
  startsOn: text("starts_on").notNull(), endsOn: text("ends_on").notNull(),
  location: text("location").notNull(), sourceId: text("source_id").notNull().references(() => sources.id),
}, (t) => [index("competition_scope_date").on(t.discipline, t.season, t.startsOn)]);
export const competitionEvents = sqliteTable("competition_events", {
  id: text("id").primaryKey(), competitionId: text("competition_id").notNull().references(() => competitions.id),
  sourceEventNumber: text("source_event_number").notNull(), label: text("label").notNull(),
  groupLabel: text("group_label").notNull(), distance: integer("distance").notNull(), round: text("round").notNull(),
}, (t) => [index("event_competition").on(t.competitionId)]);
// These IDs are competition-local; cross-competition identity is a later milestone.
export const participants = sqliteTable("participants", {
  id: text("id").primaryKey(), competitionId: text("competition_id").notNull().references(() => competitions.id),
  bib: text("bib").notNull(), name: text("name").notNull(), affiliation: text("affiliation").notNull(),
}, (t) => [uniqueIndex("participant_competition_bib").on(t.competitionId, t.bib)]);
export const entries = sqliteTable("entries", {
  id: text("id").primaryKey(), participantId: text("participant_id").notNull().references(() => participants.id),
  division: text("division").notNull(), ageStatus: text("age_status"),
  rawName: text("raw_name").notNull(), sourcePage: integer("source_page").notNull(),
}, (t) => [index("entry_participant").on(t.participantId)]);
export const results = sqliteTable("results", {
  id: text("id").primaryKey(), competitionId: text("competition_id").notNull().references(() => competitions.id),
  participantId: text("participant_id").notNull().references(() => participants.id),
  raceId: text("race_id").notNull(), distance: integer("distance").notNull(), round: text("round").notNull(),
  rank: integer("rank"), timeRaw: text("time_raw"), timeMicroseconds: integer("time_microseconds"),
  resultStatus: text("result_status"),
  finishNote: text("finish_note"),
  qualification: text("qualification"), sourcePage: integer("source_page").notNull(),
  eventKey: text("event_key"), eventLabel: text("event_label"), raceLabel: text("race_label"),
  heatNumber: integer("heat_number"), heatTotal: integer("heat_total"),
}, (t) => [index("result_competition_distance").on(t.competitionId, t.distance)]);

export const importBatches = sqliteTable("import_batches", {
  id: text("id").primaryKey(), candidateKey: text("candidate_key").notNull(),
  competitionId: text("competition_id"),
  status: text("status").notNull(), reportJson: text("report_json").notNull(),
  createdAt: text("created_at").notNull(), publishedAt: text("published_at"),
});
export const importPublications = sqliteTable("import_publications", {
  competitionId: text("competition_id").primaryKey(),
  batchId: text("batch_id").notNull().references(() => importBatches.id),
});
// Inserting zero aborts the whole D1 batch, including concurrent stale publishes.
export const importAssertions = sqliteTable("import_assertions", {
  value: integer("value").notNull(),
}, () => [check("import_assertion_passes", sql`value = 1`)]);

// Original documents and publication lineage are immutable, independent of the live projection.
export const sourceDocuments = sqliteTable("source_documents", {
  sha256: text("sha256").primaryKey(), url: text("url").notNull(), objectKey: text("object_key").notNull(),
  byteLength: integer("byte_length").notNull(), archivedAt: text("archived_at").notNull(),
});
export const publicationRevisions = sqliteTable("publication_revisions", {
  batchId: text("batch_id").primaryKey().references(() => importBatches.id), competitionId: text("competition_id").notNull(),
  previousBatchId: text("previous_batch_id"), sourceId: text("source_id").notNull(), sourceHash: text("source_hash").notNull(),
  seasonLabel: text("season_label").notNull(), reviewer: text("reviewer").notNull(), notes: text("notes").notNull(),
  metadataJson: text("metadata_json").notNull(), publishedAt: text("published_at").notNull(),
}, t => [index("revision_competition_time").on(t.competitionId, t.publishedAt)]);
export const races = sqliteTable("races", {
  id: text("id").primaryKey(), competitionId: text("competition_id").notNull().references(() => competitions.id),
  eventKey: text("event_key").notNull(), sourceRaceId: text("source_race_id").notNull(), label: text("label").notNull(),
  heatNumber: integer("heat_number"), heatTotal: integer("heat_total"), finalTier: text("final_tier"), sourcePage: integer("source_page").notNull(),
}, t => [index("race_competition_event").on(t.competitionId, t.eventKey)]);
export const classificationPages = sqliteTable("classification_pages", {
  id: text("id").primaryKey(), batchId: text("batch_id").notNull(), competitionId: text("competition_id").notNull(),
  sourcePage: integer("source_page").notNull(), kind: text("kind").notNull(), label: text("label").notNull(),
  textRaw: text("text_raw").notNull(), rowsJson: text("rows_json").notNull(),
}, t => [index("classification_batch").on(t.batchId, t.sourcePage)]);
export const skaters = sqliteTable("skaters", {
  id: text("id").primaryKey(), displayName: text("display_name").notNull(), createdAt: text("created_at").notNull(),
});
export const skaterLinks = sqliteTable("skater_links", {
  participantKey: text("participant_key").primaryKey(), competitionId: text("competition_id").notNull(), bib: text("bib").notNull(),
  skaterId: text("skater_id").notNull().references(() => skaters.id), name: text("name").notNull(), affiliation: text("affiliation").notNull(),
  status: text("status").notNull(), revision: text("revision").notNull(),
}, t => [index("link_skater").on(t.skaterId)]);
export const skaterAliases = sqliteTable("skater_aliases", {
  id: text("id").primaryKey(), participantKey: text("participant_key").notNull(), batchId: text("batch_id").notNull(),
  rawName: text("raw_name").notNull(), name: text("name").notNull(), sourcePage: integer("source_page").notNull(),
}, t => [index("alias_participant").on(t.participantKey)]);
export const skaterObservations = sqliteTable("skater_observations", {
  id: text("id").primaryKey(), participantKey: text("participant_key").notNull(), batchId: text("batch_id").notNull(),
  competitionId: text("competition_id").notNull(), competedOn: text("competed_on").notNull(), season: text("season").notNull(),
  affiliation: text("affiliation").notNull(), ageCategory: text("age_category"), division: text("division").notNull(),
  rawName: text("raw_name").notNull(), sourceHash: text("source_hash").notNull(), sourcePage: integer("source_page").notNull(),
}, t => [index("observation_person_date").on(t.participantKey, t.competedOn), index("observation_batch").on(t.batchId)]);
export const identityDecisions = sqliteTable("identity_decisions", {
  id: text("id").primaryKey(), participantKey: text("participant_key").notNull(), previousRevision: text("previous_revision").notNull(),
  previousSkaterId: text("previous_skater_id").notNull(), skaterId: text("skater_id").notNull(),
  reviewer: text("reviewer").notNull(), reason: text("reason").notNull(), evidenceJson: text("evidence_json").notNull(), createdAt: text("created_at").notNull(),
});
export const ageRules = sqliteTable("age_rules", {
  id: text("id").primaryKey(), definitionJson: text("definition_json").notNull(), reviewer: text("reviewer").notNull(), createdAt: text("created_at").notNull(),
});
export const competitionAgeRules = sqliteTable("competition_age_rules", {
  competitionId: text("competition_id").primaryKey(), ruleId: text("rule_id").notNull().references(() => ageRules.id),
  revision: text("revision").notNull(), reviewer: text("reviewer").notNull(),
});
export const ageRuleDecisions = sqliteTable("age_rule_decisions", {
  id: text("id").primaryKey(), competitionId: text("competition_id").notNull(), previousRevision: text("previous_revision"),
  ruleId: text("rule_id").notNull(), reviewer: text("reviewer").notNull(), reason: text("reason").notNull(), createdAt: text("created_at").notNull(),
});
