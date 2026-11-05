import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

// Activation secrets and session tokens are stored only as SHA-256 digests.
export const activationCodes = sqliteTable('activation_codes', {
  id: text('id').primaryKey(),
  orderNumber: text('order_number').notNull(),
  // Legacy order column remains for previously redeemed memberships. New codes
  // use an internal reference there; customer orders bind only at redemption.
  customerOrderNumber: text('customer_order_number'),
  codeHash: text('code_hash').notNull(),
  status: text('status', { enum: ['available', 'used', 'disabled'] }).notNull().default('available'),
  redeemedBy: text('redeemed_by'),
  createdAt: integer('created_at').notNull(),
  redeemedAt: integer('redeemed_at'),
  disabledAt: integer('disabled_at'),
}, table => [uniqueIndex('activation_order_unique').on(table.orderNumber), uniqueIndex('activation_hash_unique').on(table.codeHash), uniqueIndex('activation_customer_order_unique').on(table.customerOrderNumber)]);

export const members = sqliteTable('members', {
  id: text('id').primaryKey(),
  phone: text('phone').notNull(),
  passwordHash: text('password_hash').notNull(),
  passwordSalt: text('password_salt').notNull(),
  passwordIterations: integer('password_iterations').notNull(),
  activationCodeId: text('activation_code_id').notNull().references(() => activationCodes.id),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at').notNull(),
}, table => [uniqueIndex('member_phone_unique').on(table.phone), uniqueIndex('member_code_unique').on(table.activationCodeId)]);

export const memberSessions = sqliteTable('member_sessions', {
  tokenHash: text('token_hash').primaryKey(),
  memberId: text('member_id').notNull().references(() => members.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at').notNull(),
  expiresAt: integer('expires_at').notNull(),
}, table => [index('session_member_idx').on(table.memberId), index('session_expiry_idx').on(table.expiresAt)]);

export const authRateLimits = sqliteTable('auth_rate_limits', {
  bucketKey: text('bucket_key').primaryKey(),
  attempts: integer('attempts').notNull(),
  expiresAt: integer('expires_at').notNull(),
}, table => [index('rate_expiry_idx').on(table.expiresAt)]);
