# 💻 Example cURL Commands — Hibe Technical Challenge

This document includes examples of how to test each API endpoint using **cURL** from the terminal.

> ⚙️ Make sure you have the server running:
> ```
> npm run dev
> ```
> And the environment variables correctly configured in the `.env` file.
---

## 🟢 1. Create an individual payment

```bash
curl -X POST http://localhost:3000/api/v1/payments   -H “Content-Type: application/json”   -H “Idempotency-Key: key-1”   -d '{
    “description”: “Test service”,
    “due_date”: “2025-10-20”,
    “amount_cents”: 1500,
    “currency”: “USD”,
    “payer”: { “name”: “Lautaro”, ‘email’: “lauta@example.com” }
  }'
```
---

## 🟡 2. List existing payments

```bash
curl -X GET http://localhost:3000/api/v1/payments
```
---

## 🔵 3. Create batch payments

```bash
curl -X POST http://localhost:3000/api/v1/payments/batch   -H “Content-Type: application/json”   -H “Idempotency-Key: batch-1”   -d '[
    {
      “description”: “Valid payment”,
      “due_date”: “2025-10-20”,
      “amount_cents”: 1000,
      “currency”: “USD”,
      “payer”: { “name”: “Juan”, ‘email’: “juan@example.com” }
    },
    {
      “description”: “Invalid payment”,
      “due_date”: “2025-10-20”,
      “amount_cents”: 1500,
      “currency”: “USD”,
      “payer”: { ‘name’: “Pedro” }
    }
  ]'
```
---

## 🧩 4. Simular Webhook de actualización de estado

```bash
curl -X POST http://localhost:3000/api/v1/webhook   -H «Content-Type: application/json»   -H «X-Webhook-Token: change_me_secret_token»   -d “{«payment_id»: «uuid», “status”: «paid»}”
```
---

## 🔁 5. Probar idempotencia (repetir con la misma clave)

```bash
curl -X POST http://localhost:3000/api/v1/payments   -H «Content-Type: application/json»   -H «Idempotency-Key: key-1»   -d '{
    «description»: «Servicio de prueba»,
    «due_date»: «2025-10-20»,
    «amount_cents»: 1500,
    «currency»: «USD»,
    «payer»: { «name»: «Lautaro», “email”: «lauta@example.com» }
  }'
```