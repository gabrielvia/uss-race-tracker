ALTER TABLE `competition_events` ADD `distance_unit` text DEFAULT 'metres' NOT NULL;--> statement-breakpoint
ALTER TABLE `competition_events` ADD `event_kind` text DEFAULT 'individual' NOT NULL;--> statement-breakpoint
ALTER TABLE `participants` ADD `country` text;--> statement-breakpoint
ALTER TABLE `results` ADD `distance_unit` text DEFAULT 'metres' NOT NULL;--> statement-breakpoint
ALTER TABLE `results` ADD `event_kind` text DEFAULT 'individual' NOT NULL;--> statement-breakpoint
ALTER TABLE `results` ADD `lane` text;--> statement-breakpoint
ALTER TABLE `results` ADD `points_raw` text;--> statement-breakpoint
ALTER TABLE `results` ADD `behind_raw` text;