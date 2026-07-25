import express from 'express';
import cors from 'cors';
import orderRouter from './routes/order.js';

const log = console;

const app = express();
const PORT = process.env.SERVER_PORT || 8002;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// 健康检查
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// 订单提交
app.use('/api/order', orderRouter);

// 404
app.use((_req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// 错误处理
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  log.error('[server] 未捕获错误:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(PORT, () => {
  log.info(`[server] 后端服务已启动，端口: ${PORT}`);
});
