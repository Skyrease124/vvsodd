ALTER TABLE `knowledge_chunks` ADD `page_index` integer;--> statement-breakpoint
ALTER TABLE `knowledge_chunks` ADD `page_end` integer;--> statement-breakpoint
ALTER TABLE `knowledge_chunks` ADD `page_label` text;--> statement-breakpoint
ALTER TABLE `knowledge_chunks` ADD `printed_page` text;--> statement-breakpoint
ALTER TABLE `knowledge_chunks` ADD `location_status` text DEFAULT 'legacy' NOT NULL;