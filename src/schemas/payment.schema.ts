import { z } from 'zod';

export const payerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email()
});

export const createPaymentSchema = z.object({
  description: z.string().min(1),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount_cents: z.number().int().positive(),
  currency: z.enum(['USD','ARS']),
  payer: payerSchema
});
