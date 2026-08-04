CREATE TABLE `category_pricing_rules` (
	`category` text PRIMARY KEY NOT NULL,
	`margin_percent` real DEFAULT 0 NOT NULL,
	`vendor_shipping_rate` real DEFAULT 0 NOT NULL,
	`vendor_processing_fee` real DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `products` DROP COLUMN `cost`;--> statement-breakpoint
ALTER TABLE `products` DROP COLUMN `margin_percent`;--> statement-breakpoint
ALTER TABLE `products` DROP COLUMN `vendor_shipping_rate`;--> statement-breakpoint
ALTER TABLE `products` DROP COLUMN `vendor_processing_fee`;