CREATE TABLE `activation_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`order_number` text NOT NULL,
	`code_hash` text NOT NULL,
	`status` text DEFAULT 'available' NOT NULL,
	`redeemed_by` text,
	`created_at` integer NOT NULL,
	`redeemed_at` integer,
	`disabled_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `activation_order_unique` ON `activation_codes` (`order_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `activation_hash_unique` ON `activation_codes` (`code_hash`);--> statement-breakpoint
CREATE TABLE `auth_rate_limits` (
	`bucket_key` text PRIMARY KEY NOT NULL,
	`attempts` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `rate_expiry_idx` ON `auth_rate_limits` (`expires_at`);--> statement-breakpoint
CREATE TABLE `member_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `session_member_idx` ON `member_sessions` (`member_id`);--> statement-breakpoint
CREATE INDEX `session_expiry_idx` ON `member_sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`phone` text NOT NULL,
	`password_hash` text NOT NULL,
	`password_salt` text NOT NULL,
	`password_iterations` integer NOT NULL,
	`activation_code_id` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`activation_code_id`) REFERENCES `activation_codes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `member_phone_unique` ON `members` (`phone`);--> statement-breakpoint
CREATE UNIQUE INDEX `member_code_unique` ON `members` (`activation_code_id`);