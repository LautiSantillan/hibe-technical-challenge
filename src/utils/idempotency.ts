import { db } from '../db';
import { idempotency_keys } from '../db/schema';
import { eq } from 'drizzle-orm';
import { createHash } from 'crypto';

export function hashPayload(payload:any){
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export async function findIdempotency(key:string){
  const row = await db.select().from(idempotency_keys).where(eq(idempotency_keys.key, key)).limit(1);
  return row[0];
}

export function storeIdempotency(key:string, request_hash:string, payment_id:string|null, response_body:any){
  db.insert(idempotency_keys).values({
    key,
    request_hash,
    payment_id,
    response_body: JSON.stringify(response_body),
    created_at: new Date().toISOString()
  }).run();
}
