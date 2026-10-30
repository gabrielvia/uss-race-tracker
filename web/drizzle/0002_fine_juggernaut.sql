CREATE TABLE `import_assertions` (
	`value` integer NOT NULL,
	CONSTRAINT "import_assertion_passes" CHECK(value = 1)
);
--> statement-breakpoint
CREATE TABLE `import_batches` (
	`id` text PRIMARY KEY NOT NULL,
	`candidate_key` text NOT NULL,
	`status` text NOT NULL,
	`report_json` text NOT NULL,
	`created_at` text NOT NULL,
	`published_at` text
);
--> statement-breakpoint
CREATE TABLE `import_publications` (
	`competition_id` text PRIMARY KEY NOT NULL,
	`batch_id` text NOT NULL,
	FOREIGN KEY (`batch_id`) REFERENCES `import_batches`(`id`) ON UPDATE no action ON DELETE no action
);
