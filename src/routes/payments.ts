import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { createPaymentSchema } from '../schemas/payment.schema';
import { hashPayload, findIdempotency, storeIdempotency } from '../utils/idempotency';
import { db } from '../db';
import { payments } from '../db/schema';
import pLimit from 'p-limit';
import { desc, eq, lt } from "drizzle-orm";

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
  db.insert(payments).values({
    id, description: data.description, due_date: data.due_date,
    amount_cents: data.amount_cents, currency: data.currency,
    payer_name: data.payer.name, payer_email: data.payer.email,
    status: 'pending', checkout_url, created_at: now, updated_at: now
  }).run();
  const response = { payment_id: id, status: 'pending', checkout_url };
  storeIdempotency(key, hash, id, response);
  res.status(201).json(response);
});

router.get("/", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
    const status = req.query.status as string | undefined;
    const cursor = req.query.cursor as string | undefined;

    let query = db.select().from(payments) as any;

    if (status) {
      query = query.where(eq(payments.status, status));
    }

    if (cursor) {
      query = query.where(lt(payments.created_at, cursor));
    }

    const rows = await query.orderBy(desc(payments.created_at)).limit(limit + 1); 

    let next_cursor: string | null = null;

    if (rows.length > limit) {
      const last = rows.pop(); 
      next_cursor = last?.created_at ?? null;
    }
    
    res.json({items: rows,next_cursor});
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "internal_error" });
  }
});

router.post('/batch', async (req, res) => {
  const key = req.header('Idempotency-Key');
  if (!key) return res.status(400).json({ error: 'Missing Idempotency-Key header' });

  if (!Array.isArray(req.body))
    return res.status(400).json({ error: 'Body must be an array' });

  const items = req.body as any[];
  if (items.length > 100)
    return res.status(400).json({ error: 'batch_too_large' });

  const batchHash = hashPayload(items);
  const existing = await findIdempotency(key);
  if (existing) {
    if (existing.request_hash === batchHash && existing.response_body) {
      return res.json(JSON.parse(existing.response_body));
    }
    return res.status(409).json({ error: 'idempotency_conflict' });
  }

  const CONCURRENCY = 5;
  const MAX_RETRIES = parseInt(process.env.BATCH_MAX_RETRIES || '3', 10);
  const RETRY_DELAY_MS = parseInt(process.env.BATCH_RETRY_DELAY_MS || '500', 10);

  const limit = pLimit(CONCURRENCY);
  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const results: Array<any> = [];
  let succeeded = 0;
  let failed = 0;

  async function processItem(item: any, index: number) {
    const parsed = createPaymentSchema.safeParse(item);

    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      const field = firstError?.path?.join('.') || 'unknown_field';
      const message =
        firstError?.message === 'Required'
          ? `Missing required field: ${field}`
          : firstError?.message || 'Validation error';

      return {
        index,
        error: { code: 'validation_error', message }
      };
    }

    let attempt = 0;
    while (attempt <= MAX_RETRIES) {
      try {
        const id = uuidv4();
        const now = new Date().toISOString();
        const checkout_url = `https://sandbox.hibe.local/checkout/${id}`;

        db.insert(payments).values({
          id,
          description: item.description,
          due_date: item.due_date,
          amount_cents: item.amount_cents,
          currency: item.currency,
          payer_name: item.payer.name,
          payer_email: item.payer.email,
          status: 'pending',
          checkout_url,
          created_at: now,
          updated_at: now
        }).run();

        return { index, payment_id: id, status: 'pending' };
      } catch (err: any) {
        attempt++;
        if (attempt > MAX_RETRIES) {
          return {
            index,
            error: {
              code: 'processing_error',
              message: err?.message || 'unknown'
            }
          };
        }
        await sleep(RETRY_DELAY_MS);
      }
    }
  }

  const tasks = items.map((item, i) => limit(() => processItem(item, i)));
  const settled = await Promise.all(tasks);

  for (const r of settled) {
    if (!r) continue;
    if (r.error) failed++;
    else succeeded++;
    results.push(r);
  }

  const response = { results, failed, succeeded };
  storeIdempotency(key, batchHash, null, response);
  return res.json(response);
});


export default router;
