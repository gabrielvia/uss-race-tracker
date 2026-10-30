CREATE TABLE `__new_results` (
	`id` text PRIMARY KEY NOT NULL,
	`competition_id` text NOT NULL,
	`participant_id` text NOT NULL,
	`race_id` text NOT NULL,
	`distance` integer NOT NULL,
	`round` text NOT NULL,
	`rank` integer,
	`time_raw` text,
	`time_microseconds` integer,
	`result_status` text,
	`qualification` text,
	`source_page` integer NOT NULL,
	`event_key` text,
	`event_label` text,
	`race_label` text,
	`heat_number` integer,
	`heat_total` integer,
	FOREIGN KEY (`competition_id`) REFERENCES `competitions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_results`("id", "competition_id", "participant_id", "race_id", "distance", "round", "rank", "time_raw", "time_microseconds", "result_status", "qualification", "source_page", "event_key", "event_label", "race_label", "heat_number", "heat_total") SELECT "id", "competition_id", "participant_id", "race_id", "distance", "round", "rank", "time_raw", "time_microseconds", NULL, "qualification", "source_page", "event_key", "event_label", "race_label", "heat_number", "heat_total" FROM `results`;--> statement-breakpoint
DROP TABLE `results`;--> statement-breakpoint
ALTER TABLE `__new_results` RENAME TO `results`;--> statement-breakpoint
CREATE INDEX `result_competition_distance` ON `results` (`competition_id`,`distance`);