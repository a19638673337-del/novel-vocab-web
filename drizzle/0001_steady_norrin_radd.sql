ALTER TABLE `activation_codes` ADD `customer_order_number` text;--> statement-breakpoint
CREATE UNIQUE INDEX `activation_customer_order_unique` ON `activation_codes` (`customer_order_number`);