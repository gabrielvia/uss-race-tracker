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
});
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
  qualification: text("qualification"), sourcePage: integer("source_page").notNull(),
  eventKey: text("event_key"), eventLabel: text("event_label"), raceLabel: text("race_label"),
  heatNumber: integer("heat_number"), heatTotal: integer("heat_total"),
}, (t) => [index("result_competition_distance").on(t.competitionId, t.distance)]);

export const importBatches = sqliteTable("import_batches", {
  id: text("id").primaryKey(), candidateKey: text("candidate_key").notNull(),
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
