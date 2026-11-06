import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import pg from 'pg';
import { PG_SCHEMA_SQL } from '../server/pgSchema.mjs';
import { createApp } from '../server/app.mjs';
import { startTestApp, setupAdmin } from './helpers.mjs';

import os from 'node:os';
import path from 'node:path';
import { openDatabase } from '../server/db.mjs';

const TABLES = [
  'projects',
  'members',
  'tasks',
  'subtasks',
  'activities',
  'ai_settings',
  'ai_messages',
  'users',
  'sessions',
  'chat_groups',
  'chat_group_messages',
];

test('supabase/schema.sql matches the schema the server applies', async () => {
  const file = fs.readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
  const normalize = s => s.replace(/\r\n/g, '\n');
  assert.ok(normalize(file).includes(normalize(PG_SCHEMA_SQL).trim()), 'run the generator in server/pgSchema.mjs docs');
  for (const table of TABLES) {
    assert.ok(file.includes(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`), table);
  }

  // SQLite schema must include the matching performance indexes
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flow-schema-idx-'));
  const db = await openDatabase({ dbPath: path.join(tmpDir, 'test.sqlite') });
  const idxRows = await db.all("SELECT name FROM sqlite_master WHERE type = 'index'");
  const idxNames = idxRows.map((r) => r.name);
  for (const expectedIdx of [
    'idx_tasks_project_id',
    'idx_tasks_status',
    'idx_tasks_due_date',
    'idx_subtasks_task_id',
    'idx_activities_task_id',
    'idx_chat_messages_group_id',
  ]) {
    assert.ok(idxNames.includes(expectedIdx), `Missing SQLite index: ${expectedIdx}`);
  }
  await db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test(
  'Postgres schema enables RLS everywhere and re-applies idempotently',
  { skip: !process.env.FLOW_TEST_DATABASE_URL && 'set FLOW_TEST_DATABASE_URL' },
  async (t) => {
    const { api, databaseUrl } = await startTestApp(t);
    const { token } = await setupAdmin(api);
    await api('POST', '/api/projects', {
      token,
      body: { name: '保留的数据', code: 'KEEP', color: '#6366f1' },
    });

    const client = new pg.Client({ connectionString: databaseUrl });
    await client.connect();
    const { rows } = await client
      .query(
        "SELECT relname, relrowsecurity FROM pg_class WHERE relkind = 'r' AND relnamespace = 'public'::regnamespace"
      )
      .finally(() => client.end());
    const rls = Object.fromEntries(rows.map((r) => [r.relname, r.relrowsecurity]));
    for (const table of TABLES) {
      assert.equal(rls[table], true, `RLS should be enabled on ${table}`);
    }

    // A second instance starting against the same database keeps the data
    const second = createApp({ databaseUrl });
    await second.ready;
    await second.closeDb();
    const boot = await api('GET', '/api/bootstrap', { token });
    assert.deepEqual(boot.data.projects.map((p) => p.name), ['保留的数据']);
  }
);
