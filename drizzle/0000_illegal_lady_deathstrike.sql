CREATE TABLE `conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`user_did` text NOT NULL,
	`title` text DEFAULT 'New chat' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_did`) REFERENCES `users`(`did`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`conversation_id` text NOT NULL,
	`seq` integer NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`reasoning` text,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`conversation_id`, `seq`),
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`user_did` text PRIMARY KEY NOT NULL,
	`model` text,
	`friends_only` integer DEFAULT false NOT NULL,
	`temperature` real DEFAULT 0.7 NOT NULL,
	`top_p` real DEFAULT 1 NOT NULL,
	`max_tokens` integer DEFAULT 1024 NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_did`) REFERENCES `users`(`did`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`did` text PRIMARY KEY NOT NULL,
	`handle` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
