import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { createPaymentSchema } from '../schemas/payment.schema';
import { hashPayload, findIdempotency, storeIdempotency } from '../utils/idempotency';
import { db } from '../db';
import { payments } from '../db/schema';
import pLimit from 'p-limit';
import { desc } from "drizzle-orm";

const router = express.Router();

router.post('/', async (req, res) => {
  const key = req.header('Idempotency-Key');
  if (!key) return res.status(400).json({ error: 'Missing Idempotency-Key header' });
  const parsed = createPaymentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'validation_error', details: parsed.error.errors });
  const data = parsed.data;
  const hash = hashPayload(data);
  const existing = await findIdempotency(key);
  if (existing) {
    if (existing.request_hash === hash && existing.response_body)
      return res.status(201).json(JSON.parse(existing.response_body));
    return res.status(409).json({ error: 'idempotency_conflict' });
  }
  const id = uuidv4();
  const now = new Date().toISOString();
  const checkout_url = `https://sandbox.hibe.local/checkout/${id}`;
  await db.insert(payments).values({
    id, description: data.description, due_date: data.due_date,
    amount_cents: data.amount_cents, currency: data.currency,
    payer_name: data.payer.name, payer_email: data.payer.email,
    status: 'pending', checkout_url, created_at: now, updated_at: now
  }).run();
  const response = { payment_id: id, status: 'pending', checkout_url };
  await storeIdempotency(key, hash, id, response);
  res.status(201).json(response);
});

router.get('/', async (req, res) => {
  const limit = Math.min(parseInt((req.query.limit as string) || '10'), 100);
  const rows = await db.select().from(payments).orderBy(desc(payments.created_at)).limit(limit);
  res.json(rows);
});

router.post('/batch', async (req, res) => {
  const key = req.header('Idempotency-Key');
  if (!key) return res.status(400).json({ error: 'Missing Idempotency-Key header' });
  if (!Array.isArray(req.body)) return res.status(400).json({ error: 'Body must be array' });
  const hash = hashPayload(req.body);
  const existing = await findIdempotency(key);
  if (existing) {
    if (existing.request_hash === hash && existing.response_body)
      return res.json(JSON.parse(existing.response_body));
    return res.status(409).json({ error: 'idempotency_conflict' });
  }
  const limit = pLimit(5);
  const results: any[] = [];
  for (const item of req.body) {
    const parsed = createPaymentSchema.safeParse(item);
    if (!parsed.success) {
      results.push({ error: 'validation_error' });
      continue;
    }
    await limit(async () => {
      const id = uuidv4();
      const now = new Date().toISOString();
      db.insert(payments).values({
        id, description: item.description, due_date: item.due_date,
        amount_cents: item.amount_cents, currency: item.currency,
        payer_name: item.payer.name, payer_email: item.payer.email,
        status: 'pending', created_at: now, updated_at: now
      }).run();
      results.push({ payment_id: id });
    });
  }
  const response = { results };
  await storeIdempotency(key, hash, null, response);
  res.json(response);
});

export default router;
