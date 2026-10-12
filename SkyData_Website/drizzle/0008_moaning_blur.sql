CREATE TABLE `blender_scene_request` (
	`owner` text PRIMARY KEY NOT NULL,
	`id` text NOT NULL,
	`device_id` text NOT NULL,
	`created` integer NOT NULL,
	`expires` integer NOT NULL,
	`status` text NOT NULL,
	`completed` integer,
	`snapshot` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `blender_scene_request_id_unique` ON `blender_scene_request` (`id`);--> statement-breakpoint
ALTER TABLE `blender_device` ADD `protocol_version` integer DEFAULT 1 NOT NULL;