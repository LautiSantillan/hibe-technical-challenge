import express from 'express';
import bodyParser from 'body-parser';
import paymentsRouter from './routes/payments';
import webhooksRouter from './routes/webhooks';
const app = express();
app.use(bodyParser.json());
app.use('/api/v1/payments', paymentsRouter);
app.use('/api/v1/webhooks', webhooksRouter);
export default app;
