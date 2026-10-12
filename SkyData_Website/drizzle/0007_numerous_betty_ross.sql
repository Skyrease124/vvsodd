CREATE TABLE `blender_device` (
	`owner` text PRIMARY KEY NOT NULL,
	`id` text NOT NULL,
	`token_hash` text NOT NULL,
	`name` text NOT NULL,
	`created` integer NOT NULL,
	`last_seen` integer,
	`blender_ready` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `blender_device_id_unique` ON `blender_device` (`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `blender_device_token_hash_unique` ON `blender_device` (`token_hash`);--> statement-breakpoint
CREATE TABLE `blender_pairing` (
	`owner` text PRIMARY KEY NOT NULL,
	`code_hash` text NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `blender_pairing_code_hash_unique` ON `blender_pairing` (`code_hash`);