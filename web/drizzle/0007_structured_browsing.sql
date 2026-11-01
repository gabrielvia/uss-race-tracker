ALTER TABLE `competition_events` ADD `gender` text DEFAULT 'Unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE `competition_events` ADD `division_key` text DEFAULT 'Unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE `competition_events` ADD `competition_group` text;--> statement-breakpoint
ALTER TABLE `competition_events` ADD `scope_status` text DEFAULT 'needs-review' NOT NULL;--> statement-breakpoint
ALTER TABLE `entries` ADD `gender` text DEFAULT 'Unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE `entries` ADD `division_key` text DEFAULT 'Unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE `results` ADD `entry_id` text;--> statement-breakpoint
ALTER TABLE `results` ADD `gender` text DEFAULT 'Unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE `results` ADD `division_key` text DEFAULT 'Unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE `results` ADD `scope_status` text DEFAULT 'needs-review' NOT NULL;