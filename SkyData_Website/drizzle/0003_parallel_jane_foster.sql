CREATE TABLE `project_parts` (
	`id` text PRIMARY KEY NOT NULL,
	`project` text NOT NULL,
	`number` integer NOT NULL,
	`etag` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`size` integer NOT NULL,
	`status` text NOT NULL,
	`upload` text NOT NULL,
	`key` text NOT NULL,
	`chunks` integer NOT NULL,
	`created` integer NOT NULL
);
