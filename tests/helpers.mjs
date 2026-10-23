import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import pg from 'pg';
import { createApp } from '../server/app.mjs';

// Set FLOW_TEST_DATABASE_URL (a Postgres server URL with CREATE DATABASE
// rights) to run the suite against Postgres instead of SQLite.
const PG_ADMIN_URL = process.env.FLOW_TEST_DATABASE_URL;

async function withPgAdmin(fn) {
  const client = new pg.Client({ connectionString: PG_ADMIN_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

// Starts the API on a throwaway database (a SQLite file, or a fresh Postgres
// database) that is removed after the test.
export async function startTestApp(t) {
  let databaseUrl;
  let dir;
  let pgDatabase;
  if (PG_ADMIN_URL) {
    pgDatabase = `flow_test_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
    await withPgAdmin((client) => client.query(`CREATE DATABASE ${pgDatabase}`));
    const url = new URL(PG_ADMIN_URL);
    url.pathname = `/${pgDatabase}`;
    databaseUrl = url.toString();
  } else {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flow-test-'));
  }
  const { app, ready, closeDb } = createApp(
    databaseUrl ? { databaseUrl } : { dbPath: path.join(dir, 'flow.sqlite') }
  );
  await ready;
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await closeDb();
    if (pgDatabase) {
      await withPgAdmin((client) =>
        client.query(`DROP DATABASE IF EXISTS ${pgDatabase} WITH (FORCE)`)
      );
    } else {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  const api = async (method, url, { body, token } = {}) => {
    const res = await fetch(baseUrl + url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    return { status: res.status, data };
  };

  return { baseUrl, api, databaseUrl };
}

export async function setupAdmin(api, overrides = {}) {
  const res = await api('POST', '/api/auth/setup', {
    body: {
      username: 'admin',
      display_name: '系统超级管理员',
      password: 'admin-password-123',
      ...overrides,
    },
  });
  if (res.status !== 201) {
    throw new Error(`setup failed: ${res.status} ${JSON.stringify(res.data)}`);
  }
  return res.data;
}

// Creates an account as `adminToken` and signs in as it.
export async function createUserAndLogin(api, adminToken, account) {
  const password = account.password || 'user-password';
  const created = await api('POST', '/api/users', {
    token: adminToken,
    body: { display_name: account.username, ...account, password },
  });
  if (created.status !== 201) {
    throw new Error(
      `create user failed: ${created.status} ${JSON.stringify(created.data)}`
    );
  }
  const login = await api('POST', '/api/auth/login', {
    body: { username: account.username, password },
  });
  if (login.status !== 200) {
    throw new Error(`login failed: ${login.status} ${JSON.stringify(login.data)}`);
  }
  return { user: created.data, token: login.data.token };
}
