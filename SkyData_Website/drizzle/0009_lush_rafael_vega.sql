CREATE TABLE `blender_command` (
	`owner` text PRIMARY KEY NOT NULL,
	`id` text NOT NULL,
	`device_id` text NOT NULL,
	`created` integer NOT NULL,
	`expires` integer NOT NULL,
	`status` text NOT NULL,
	`prompt` text NOT NULL,
	`plan` text,
	`completed` integer,
	`message` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `blender_command_id_unique` ON `blender_command` (`id`);