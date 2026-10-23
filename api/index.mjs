import express from 'express';
import { createApp } from '../server/app.mjs';

let app;
if (process.env.VERCEL && !process.env.DATABASE_URL) {
  // Vercel functions have no persistent disk: a SQLite file in /tmp would lose
  // every account and task on each cold start and reopen first-run setup.
  app = express();
  app.use('/api', (_req, res) => {
    res.status(503).json({
      error:
        'Vercel 部署需要配置 DATABASE_URL（Supabase / PostgreSQL 连接串），否则数据会在冷启动后丢失。',
    });
  });
} else {
  ({ app } = createApp({
    dbPath: process.env.FLOW_DB_PATH || undefined,
    databaseUrl: process.env.DATABASE_URL || undefined,
  }));
}

export default app;
