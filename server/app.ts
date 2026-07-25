import express from 'express';
import cors from 'cors';
import orderRouter from './routes/order.js';

const app = express();

app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '64kb' }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.use('/api/order', orderRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[server] unhandled error', { errorName: error.name });
  res.status(500).json({ error: 'Internal Server Error' });
});

export default app;
