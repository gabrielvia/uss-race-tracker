CREATE TABLE `competition_events` (
	`id` text PRIMARY KEY NOT NULL,
	`competition_id` text NOT NULL,
	`source_event_number` text NOT NULL,
	`label` text NOT NULL,
	`group_label` text NOT NULL,
	`distance` integer NOT NULL,
	`round` text NOT NULL,
	FOREIGN KEY (`competition_id`) REFERENCES `competitions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `event_competition` ON `competition_events` (`competition_id`);