CREATE TABLE `channel_listings` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`channel` text NOT NULL,
	`status` text NOT NULL,
	`overrides` text NOT NULL,
	`fields` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`sku` text NOT NULL,
	`category` text NOT NULL,
	`description` text NOT NULL,
	`image_url` text NOT NULL,
	`price` real NOT NULL,
	`currency` text NOT NULL,
	`stock` integer NOT NULL,
	`status` text NOT NULL,
	`vendor_name` text NOT NULL,
	`import_url` text NOT NULL,
	`source_url` text NOT NULL,
	`imported_at` text NOT NULL,
	`image_prompt` text,
	`image_prompt_generated_at` text
);
