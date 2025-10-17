import express from 'express';
import { db } from '../db';
import { payments, payment_history } from '../db/schema';
import { eq } from 'drizzle-orm';

const router = express.Router();

router.post('/simulate', async (req, res) => {
  const token = req.header('X-Webhook-Token');
  if (token !== process.env.WEBHOOK_TOKEN) return res.status(401).json({ error: 'invalid_token' });
  const { payment_id, new_status, reason } = req.body;
  if (!payment_id || !['paid','reversed'].includes(new_status))
    return res.status(400).json({ error: 'invalid_body' });
  const row = await db.select().from(payments).where(eq(payments.id, payment_id)).limit(1);
  const payment = row[0];
  if (!payment) return res.status(404).json({ error: 'payment_not_found' });
  const allowed = (payment.status === 'pending' && new_status === 'paid') || (payment.status === 'paid' && new_status === 'reversed');
  if (!allowed) return res.status(422).json({ error: 'invalid_transition' });
  db.update(payments).set({ status: new_status, updated_at: new Date().toISOString() }).where(eq(payments.id, payment_id)).run();
  db.insert(payment_history).values({
    payment_id, previous_status: payment.status, new_status, reason, created_at: new Date().toISOString()
  }).run();
  res.json({ payment_id, status: new_status });
});

export default router;
