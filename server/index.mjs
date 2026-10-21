import { createApp } from './app.mjs';

const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST || '0.0.0.0';
const DB_PATH = process.env.FLOW_DB_PATH || undefined;

const { app } = createApp(DB_PATH);

app.listen(PORT, HOST, () => {
  console.log(`🚀 Flow Server running at http://localhost:${PORT} (bound to ${HOST}:${PORT})`);
});
