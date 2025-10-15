import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const payments = sqliteTable('payments', {
  id: text('id').primaryKey(),
  description: text('description').notNull(),
  due_date: text('due_date').notNull(),
  amount_cents: integer('amount_cents').notNull(),
  currency: text('currency').notNull(),
  payer_name: text('payer_name').notNull(),
  payer_email: text('payer_email').notNull(),
  status: text('status').notNull(),
  checkout_url: text('checkout_url'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull()
});

export const idempotency_keys = sqliteTable('idempotency_keys', {
  key: text('key').primaryKey(),
  request_hash: text('request_hash').notNull(),
  payment_id: text('payment_id'),
  response_body: text('response_body'),
  created_at: text('created_at').notNull()
});

export const payment_history = sqliteTable('payment_history', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  payment_id: text('payment_id').notNull(),
  previous_status: text('previous_status'),
  new_status: text('new_status').notNull(),
  reason: text('reason'),
  created_at: text('created_at').notNull()
});
