CREATE TABLE `knowledge_batches` (
	`id` text PRIMARY KEY NOT NULL,
	`document` text NOT NULL,
	`number` integer NOT NULL,
	`hash` text NOT NULL,
	FOREIGN KEY (`document`) REFERENCES `knowledge_documents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `knowledge_buckets` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`bucket` text NOT NULL,
	`chunk` text NOT NULL,
	FOREIGN KEY (`chunk`) REFERENCES `knowledge_chunks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `knowledge_buckets_lookup` ON `knowledge_buckets` (`owner`,`bucket`);--> statement-breakpoint
CREATE TABLE `knowledge_chunks` (
	`id` text PRIMARY KEY NOT NULL,
	`document` text NOT NULL,
	`owner` text NOT NULL,
	`ordinal` integer NOT NULL,
	`page` integer,
	`section` text NOT NULL,
	`content` text NOT NULL,
	`hash` text NOT NULL,
	`vector` blob,
	`model` text,
	`created` integer NOT NULL,
	FOREIGN KEY (`document`) REFERENCES `knowledge_documents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `knowledge_chunks_document_ordinal` ON `knowledge_chunks` (`document`,`ordinal`);--> statement-breakpoint
CREATE INDEX `knowledge_chunks_owner` ON `knowledge_chunks` (`owner`);--> statement-breakpoint
CREATE TABLE `knowledge_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`size` integer NOT NULL,
	`kind` text NOT NULL,
	`category` text NOT NULL,
	`status` text NOT NULL,
	`key` text NOT NULL,
	`upload` text NOT NULL,
	`next_batch` integer DEFAULT 0 NOT NULL,
	`units` integer DEFAULT 0 NOT NULL,
	`chunks` integer DEFAULT 0 NOT NULL,
	`indexed` integer DEFAULT 0 NOT NULL,
	`empty_units` integer DEFAULT 0 NOT NULL,
	`error` text,
	`enabled` integer DEFAULT 1 NOT NULL,
	`review` text DEFAULT 'unreviewed' NOT NULL,
	`created` integer NOT NULL,
	`updated` integer NOT NULL,
	`lease` text,
	`lease_until` integer DEFAULT 0 NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`retry_at` integer DEFAULT 0 NOT NULL,
	`metadata` text DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `knowledge_documents_owner_status` ON `knowledge_documents` (`owner`,`status`);--> statement-breakpoint
CREATE TABLE `knowledge_parts` (
	`id` text PRIMARY KEY NOT NULL,
	`document` text NOT NULL,
	`number` integer NOT NULL,
	`etag` text NOT NULL,
	FOREIGN KEY (`document`) REFERENCES `knowledge_documents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `knowledge_terms` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`term` text NOT NULL,
	`chunk` text NOT NULL,
	FOREIGN KEY (`chunk`) REFERENCES `knowledge_chunks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `knowledge_terms_lookup` ON `knowledge_terms` (`owner`,`term`);