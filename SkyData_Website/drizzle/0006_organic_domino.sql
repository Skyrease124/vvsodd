CREATE TABLE `daily_allowance` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`day` text NOT NULL,
	`used` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `members` ADD `daily_limit` integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE `members` ADD `usage_paused` integer DEFAULT 0 NOT NULL;