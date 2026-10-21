import path from 'node:path';
import os from 'node:os';
import { createApp } from '../server/app.mjs';

// In Vercel serverless environment, use /tmp for local SQLite fallback or custom FLOW_DB_PATH
const dbPath =
  process.env.FLOW_DB_PATH ||
  (process.env.VERCEL ? path.join(os.tmpdir(), 'flow.sqlite') : path.resolve('data/flow.sqlite'));

const { app } = createApp(dbPath);

export default app;
