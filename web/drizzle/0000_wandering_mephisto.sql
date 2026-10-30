CREATE TABLE `competitions` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`discipline` text NOT NULL,
	`season` text NOT NULL,
	`starts_on` text NOT NULL,
	`ends_on` text NOT NULL,
	`location` text NOT NULL,
	`source_id` text NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `entries` (
	`id` text PRIMARY KEY NOT NULL,
	`participant_id` text NOT NULL,
	`division` text NOT NULL,
	`age_status` text,
	`raw_name` text NOT NULL,
	`source_page` integer NOT NULL,
	FOREIGN KEY (`participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `entry_participant` ON `entries` (`participant_id`);--> statement-breakpoint
CREATE TABLE `participants` (
	`id` text PRIMARY KEY NOT NULL,
	`competition_id` text NOT NULL,
	`bib` text NOT NULL,
	`name` text NOT NULL,
	`affiliation` text NOT NULL,
	FOREIGN KEY (`competition_id`) REFERENCES `competitions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `participant_competition_bib` ON `participants` (`competition_id`,`bib`);--> statement-breakpoint
CREATE TABLE `results` (
	`id` text PRIMARY KEY NOT NULL,
	`competition_id` text NOT NULL,
	`participant_id` text NOT NULL,
	`race_id` text NOT NULL,
	`distance` integer NOT NULL,
	`round` text NOT NULL,
	`rank` integer NOT NULL,
	`time_raw` text NOT NULL,
	`time_microseconds` integer NOT NULL,
	`qualification` text,
	`source_page` integer NOT NULL,
	FOREIGN KEY (`competition_id`) REFERENCES `competitions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `result_competition_distance` ON `results` (`competition_id`,`distance`);--> statement-breakpoint
CREATE TABLE `sources` (
	`id` text PRIMARY KEY NOT NULL,
	`url` text NOT NULL,
	`sha256` text NOT NULL,
	`object_key` text NOT NULL
);
