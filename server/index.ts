import { loadEnvFile } from 'node:process';
import path from 'node:path';
import app from './app.js';

const envFile = path.resolve(process.cwd(), '.env.server.local');
try {
  loadEnvFile(envFile);
} catch (error) {
  const code = (error as NodeJS.ErrnoException).code;
  if (code !== 'ENOENT') throw error;
}

const PORT = process.env.SERVER_PORT || 8002;

app.listen(PORT, () => {
  console.info(`[server] listening on port ${PORT}`);
});
