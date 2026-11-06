DROP INDEX `participant_competition_bib`;--> statement-breakpoint
CREATE INDEX `participant_competition_bib` ON `participants` (`competition_id`,`bib`);