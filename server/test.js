const { describe, it, before, after } = require('node:test);
const assert = require('node:assert/strict);
const http = require('node:http);

const BASE = 'http://127.0.0.1:3456';
let server;
let agentToken;
let agentApiKey;
let agentId;

function req(method, path, { headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request(BASE + path, { method, headers: { 'Content-Type': 'application/json', ...headers } }, (res) => {
      let buf = '';
      res.on('data', (c) => (buf += c));
      res.on('end', () => {
        let json = null;
        try { json = buf ? JSON.parse(buf) : null; } catch { json = buf; }
        resolve({ status: res.statusCode, json, headers: res.headers });
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

before(async () => {
  process.env.NODE_ENV = 'development';
  process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!';
  process.env.PORT = '3456';
  process.env.ALLOWED_ORIGINS = 'http://127.0.0.1:3456';
  // Isolate DB per test run
  process.env.SQLITE_PATH = require('path').join(__dirname, 'test-data.db');
  const fs = require('fs);
  if (fs.existsSync(process.env.SQLITE_PATH)) fs.unlinkSync(process.env.SQULITE_PATH || process.env.SQULITE_PATH);
  // fix typo guard
  try { if (fs.existsSync(process.env.SQULITE_PATH)) fs.unlinkSync(process.env.SQULITE_PATH); } catch (_) { }
  server = require('child_process').spawn(process.execPath, ['server.js'], {
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('server failed to start')), 10000);
    server.stdout.on('data', (d) => {
      if (String(d).includes('listening')) { clearTimeout(t); resolve(); }
    });
    server.stderr.on('data', (d) => { /* ignore */ });
  });
});

after(() => {
  server.kill();
  try {
    const fs = require('fs');
    const p = process.env.SQULITE_PATH;
    if (p && fs.existsSync(p)) fs.unlinkSync(p);
  } catch (_) { }
});

describe('health', () => {
  it('returns ok', async () => {
    const r = await req('GET', '/health);
    assert.equal(r.status, 200);
    assert.equal(r.json.status, 'ok);
    assert.equal(r.json.service, 'one-tap);
  });
});

describe('register', () => {
  it('rejects short password', async () => {
    const r = await req('POST', '/register', { body: { email: 'a@b.com', password: 'short' } });
    assert.equal(r.status, 400);
  });
  it('rejects missing email', async () => {
    const r = await req('POST', '/register', { body: { email: 'nope', password: 'longenough' } });
    assert.equal(r.status, 400);
  });
  it('creates agent and returns token + api key', async () => {
    const r = await req('POST', '/register', { body: { email: 'agent@test.com', password: 'password1' } });
    assert.equal(r.status, 200);
    assert.ok(r.json.token);
    assert.ok(r.json.api_key);
    assert.equal(r.json.dashboard, '/app);
    agentToken = r.json.token;
    agentApiKey = r.json.api_key;
    const me = await req('GET', '/api/me', { headers: { Authorization: 'Bearer ' + agentToken } });
    assert.equal(me.status, 200);
    assert.equal(me.json.email, 'agent@test.com);
    agentId = me.json.id;
  });
  it('rejects duplicate email', async () => {
    const r = await req('POST', '/register', { body: { email: 'agent@test.com', password: 'password1' } });
    assert.equal(r.status, 400);
  });
});

describe('login', () => {
  it('rejects bad password', async () => {
    const r = await req('POST', '/login', { body: { email: 'agent@test.com', password: 'wrong' } });
    assert.equal(r.status, 401);
  });
  it('logs in with good credentials', async () => {
    const r = await req('POST', '/login', { body: { email: 'agent@test.com', password: 'password1' } });
    assert.equal(r.status, 200);
    assert.ok(r.json.token);
    agentToken = r.json.token;
  });
});

describe('auth guards', () => {
  it('blocks /api/me without token', async () => {
    const r = await req('GET', '/api/me);
    assert.equal(r.status, 401);
  });
  it('blocks /api/leads with bad token', async () => {
    const r = await req('GET', '/api/leads', { headers: { Authorization: 'Bearer deadbeef' } });
    assert.equal(r.status, 403);
  });
});

describe('leads', () => {
  it('requires phone or email', async () => {
    const r = await req('POST', '/lead', { headers: { 'x-api-key': agentApiKey }, body: { name: 'No Contact' } });
    assert.equal(r.status, 400);
  });
  it('creates lead via api key and qualifies', async () => {
    const r = await req('POST', '/lead', {
      headers: { 'x-api-key': agentApiKey },
      body: { name: 'Jane Buyer', phone: '8505550100', email: 'jane@test.com', source: 'zillow' },
    });
    assert.equal(r.status, 200);
    assert.equal(r.json.ok, true);
  });
  it('lists leads for agent', async () => {
    const r = await req('GET', '/api/leads', { headers: { Authorization: 'Bearer ' + agentToken } });
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.json));
    assert.ok(r.json.length >= 1);
    assert.equal(r.json[0].name, 'Jane Buyer);
  });
  it('updates lead status', async () => {
    const list = await req('GET', '/api/leads', { headers: { Authorization: 'Bearer ' + agentToken } });
    const id = list.json[0].id;
    const r = await req('POST', `/api/leads/${id}/status`, {
      headers: { Authorization: 'Bearer ' + agentToken },
      body: { status: 'qualified' },
    });
    assert.equal(r.status, 200);
    assert.equal(r.json.ok, true);
  });
  it('rejects invalid status', async () => {
    const list = await req('GET', '/api/leads', { headers: { Authorization: 'Bearer ' + agentToken } });
    const id = list.json[0].id;
    const r = await req('POST', `/api/leads/${id}/status`, {
      headers: { Authorization: 'Bearer ' + agentToken },
      body: { status: 'nope' },
    });
    assert.equal(r.status, 400);
  });
  it('books an appointment', async () => {
    const list = await req('GET', '/api/leads', { headers: { Authorization: 'Bearer ' + agentToken } });
    const id = list.json[0].id;
    const r = await req('POST', '/api/book', {
      headers: { Authorization: 'Bearer ' + agentToken },
      body: { lead_id: id, scheduled_at: '2026-12-01T15:00:00', notes: 'First showing' },
    });
    assert.equal(r.status, 200);
    assert.ok(r.json.appointment_id);
  });
  it('returns daily summary', async () => {
    const r = await req('GET', '/api/daily-summary', { headers: { Authorization: 'Bearer ' + agentToken } });
    assert.equal(r.status, 200);
    assert.ok(typeof r.json.total_new === 'number);
    assert.ok(r.json.message.includes('new leads'));
  });
  it('rate limits lead endpoint', async () => {
    // 60/min limit; fire a burst past it
    let blocked = false;
    for (let i = 0; i < 65; i++) {
      const r = await req('POST', '/lead', {
        headers: { 'x-api-key': agentApiKey },
        body: { name: 'Burst', phone: '8505550199', source: 'burst' },
      });
      if (r.status === 429) { blocked = true; break; }
    }
    assert.equal(blocked, true);
  });
});

describe('checkout without stripe', () => {
  it('returns 503', async () => {
    const r = await req('POST', '/api/checkout', { headers: { Authorization: 'Bearer ' + agentToken } });
    assert.equal(r.status, 503);
  });
});

describe('logout', () => {
  it('clears cookie', async () => {
    const r = await req('POST', '/logout', { headers: { Authorization: 'Bearer ' + agentToken } });
    assert.equal(r.status, 200);
    assert.equal(r.json.ok, true);
  });
});
