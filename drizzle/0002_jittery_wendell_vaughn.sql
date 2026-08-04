ALTER TABLE `products` ADD `cost` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `margin_percent` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `vendor_shipping_rate` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `vendor_processing_fee` real DEFAULT 0 NOT NULL;