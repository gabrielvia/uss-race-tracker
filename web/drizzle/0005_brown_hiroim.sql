CREATE TABLE `age_rule_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`competition_id` text NOT NULL,
	`previous_revision` text,
	`rule_id` text NOT NULL,
	`reviewer` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `age_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`definition_json` text NOT NULL,
	`reviewer` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `classification_pages` (
	`id` text PRIMARY KEY NOT NULL,
	`batch_id` text NOT NULL,
	`competition_id` text NOT NULL,
	`source_page` integer NOT NULL,
	`kind` text NOT NULL,
	`label` text NOT NULL,
	`text_raw` text NOT NULL,
	`rows_json` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `classification_batch` ON `classification_pages` (`batch_id`,`source_page`);--> statement-breakpoint
CREATE TABLE `competition_age_rules` (
	`competition_id` text PRIMARY KEY NOT NULL,
	`rule_id` text NOT NULL,
	`revision` text NOT NULL,
	`reviewer` text NOT NULL,
	FOREIGN KEY (`rule_id`) REFERENCES `age_rules`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `identity_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`participant_key` text NOT NULL,
	`previous_revision` text NOT NULL,
	`previous_skater_id` text NOT NULL,
	`skater_id` text NOT NULL,
	`reviewer` text NOT NULL,
	`reason` text NOT NULL,
	`evidence_json` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `publication_revisions` (
	`batch_id` text PRIMARY KEY NOT NULL,
	`competition_id` text NOT NULL,
	`previous_batch_id` text,
	`source_id` text NOT NULL,
	`source_hash` text NOT NULL,
	`season_label` text NOT NULL,
	`reviewer` text NOT NULL,
	`notes` text NOT NULL,
	`metadata_json` text NOT NULL,
	`published_at` text NOT NULL,
	FOREIGN KEY (`batch_id`) REFERENCES `import_batches`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `revision_competition_time` ON `publication_revisions` (`competition_id`,`published_at`);--> statement-breakpoint
CREATE TABLE `races` (
	`id` text PRIMARY KEY NOT NULL,
	`competition_id` text NOT NULL,
	`event_key` text NOT NULL,
	`source_race_id` text NOT NULL,
	`label` text NOT NULL,
	`heat_number` integer,
	`heat_total` integer,
	`final_tier` text,
	`source_page` integer NOT NULL,
	FOREIGN KEY (`competition_id`) REFERENCES `competitions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `race_competition_event` ON `races` (`competition_id`,`event_key`);--> statement-breakpoint
CREATE TABLE `skater_aliases` (
	`id` text PRIMARY KEY NOT NULL,
	`participant_key` text NOT NULL,
	`batch_id` text NOT NULL,
	`raw_name` text NOT NULL,
	`name` text NOT NULL,
	`source_page` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `alias_participant` ON `skater_aliases` (`participant_key`);--> statement-breakpoint
CREATE TABLE `skater_links` (
	`participant_key` text PRIMARY KEY NOT NULL,
	`competition_id` text NOT NULL,
	`bib` text NOT NULL,
	`skater_id` text NOT NULL,
	`name` text NOT NULL,
	`affiliation` text NOT NULL,
	`status` text NOT NULL,
	`revision` text NOT NULL,
	FOREIGN KEY (`skater_id`) REFERENCES `skaters`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `link_skater` ON `skater_links` (`skater_id`);--> statement-breakpoint
CREATE TABLE `skater_observations` (
	`id` text PRIMARY KEY NOT NULL,
	`participant_key` text NOT NULL,
	`batch_id` text NOT NULL,
	`competition_id` text NOT NULL,
	`competed_on` text NOT NULL,
	`season` text NOT NULL,
	`affiliation` text NOT NULL,
	`age_category` text,
	`division` text NOT NULL,
	`raw_name` text NOT NULL,
	`source_hash` text NOT NULL,
	`source_page` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `observation_person_date` ON `skater_observations` (`participant_key`,`competed_on`);--> statement-breakpoint
CREATE INDEX `observation_batch` ON `skater_observations` (`batch_id`);--> statement-breakpoint
CREATE TABLE `skaters` (
	`id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `source_documents` (
	`sha256` text PRIMARY KEY NOT NULL,
	`url` text NOT NULL,
	`object_key` text NOT NULL,
	`byte_length` integer NOT NULL,
	`archived_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `results` ADD `finish_note` text;--> statement-breakpoint
CREATE INDEX `competition_scope_date` ON `competitions` (`discipline`,`season`,`starts_on`);