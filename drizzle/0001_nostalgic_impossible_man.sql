CREATE TABLE `at_profile` (
	`user_did` text PRIMARY KEY NOT NULL,
	`handle` text,
	`display_name` text,
	`description` text,
	`profile_text` text,
	`facts_json` text,
	`condensed_from_count` integer DEFAULT 0 NOT NULL,
	`last_ingest_at` integer,
	`last_condensed_at` integer,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_did`) REFERENCES `users`(`did`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `at_records` (
	`uri` text PRIMARY KEY NOT NULL,
	`user_did` text NOT NULL,
	`collection` text NOT NULL,
	`json` text NOT NULL,
	`created_at` integer NOT NULL,
	`indexed_at` integer NOT NULL,
	FOREIGN KEY (`user_did`) REFERENCES `users`(`did`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `at_records_user_collection_idx` ON `at_records` (`user_did`,`collection`);--> statement-breakpoint
CREATE TABLE `ingest_state` (
	`user_did` text NOT NULL,
	`collection` text NOT NULL,
	`record_count` integer DEFAULT 0 NOT NULL,
	`last_run_at` integer,
	PRIMARY KEY(`user_did`, `collection`),
	FOREIGN KEY (`user_did`) REFERENCES `users`(`did`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `settings` ADD `gemini_api_key` text;--> statement-breakpoint
ALTER TABLE `settings` ADD `at_personalization` integer DEFAULT true NOT NULL;