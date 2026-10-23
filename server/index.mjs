import { createApp } from './app.mjs';

const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST || '0.0.0.0';
const DB_PATH = process.env.FLOW_DB_PATH || undefined;
// When set (e.g. a Supabase connection string), data is stored in PostgreSQL.
const DATABASE_URL = process.env.DATABASE_URL || undefined;

const { app } = createApp({ dbPath: DB_PATH, databaseUrl: DATABASE_URL });

app.listen(PORT, HOST, () => {
  console.log(
    `🚀 Flow Server running at http://localhost:${PORT} (bound to ${HOST}:${PORT}, storage: ${DATABASE_URL ? 'PostgreSQL' : 'SQLite'})`
  );
});
