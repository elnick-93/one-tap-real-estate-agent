const express = require('express');
const cors = require('cors');
const twilio = require('twilio');
const sgMail = require('@sendgrid/mail');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const stripeLib = require('stripe');
const crypto = require('crypto');
const path = require('path');

const app = express();
const isProd = process.env.NODE_ENV === 'production';
const JWT_SECRET = process.env.JWT_SECRET || (isProd ? null : 'dev-only-change-me-immediately');
const TWILIO_SID = process.env.TWILIO_SID || '';
const TWILIO_TOKEN = process.env.TWILIO_TOKEN || '';
const TWILIO_FROM = process.env.TWILIO_FROM || '';
const SENDGRID_KEY = process.env.SENDGRID_KEY || '';
const FROM_EMAIL = process.env.FROM_EMAIL || '';
const STRIPE_SECRET = process.env.STRIPE_SECRET || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID || '';
const APP_URL = process.env.APP_URL || 'http://127.0.0.1:3000';
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((s) => s.trim())
  : true;

if (isProd && (!JWT_SECRET || JWT_SECRET.length < 32)) {
  console.error('FATAL: JWT_SECRET must be set and at least 32 characters');
  process.exit(1);
}

if (SENDGRID_KEY) sgMail.setApiKey(SENDGRID_KEY);
const smsClient = TWILIO_SID && TWILIO_TOKEN ? twilio(TWILIO_SID, TWILIO_TOKEN) : null;
const stripe = STRIPE_SECRET ? stripeLib(STRIPE_SECRET) : null;

const hits = new Map();
function rateLimit(key, limit, windowMs) {
  const now = Date.now();
  const row = hits.get(key);
  if (!row || row.reset < now) {
    hits.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  if (row.count >= limit) return false;
  row.count += 1;
  return true;
}

app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
app.post(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    if (!stripe || !STRIPE_WEBHOOK_SECRET) return res.status(503).send('Stripe webhook not configured');
    const sig = req.headers['stripe-signature'];
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      return res.status(400).send(`Webhook signature failed: ${err.message}`);
    }
    try {
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const email = (session.customer_email || session.customer_details?.email || '').toLowerCase();
        const customerId = session.customer;
        if (email && customerId) {
          db.run(
            `UPDATE agents SET stripe_customer_id = ?, subscription_status = 'active' WHERE email = ?`,
            [customerId, email]
          );
        }
      }
      if (event.type === 'customer.subscription.deleted') {
        const sub = event.data.object;
        db.run(`UPDATE agents SET subscription_status = 'canceled' WHERE stripe_customer_id = ?`, [
          sub.customer,
        ]);
      }
      res.json({ received: true });
    } catch (e) {
      console.error(e);
      res.status(500).send('webhook handler failed');
    }
  }
);
app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/site', express.static(path.join(__dirname, '..', 'site')));

const db = new sqlite3.Database(process.env.SQLITE_PATH || path.join(__dirname, 'data.db'));
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS agents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password_hash TEXT,
    api_key TEXT UNIQUE,
    stripe_customer_id TEXT,
    subscription_status TEXT DEFAULT 'trialing',
    created_at TEXT
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id INTEGER,
    name TEXT,
    phone TEXT,
    email TEXT,
    source TEXT,
    status TEXT DEFAULT 'new',
    created_at TEXT
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id INTEGER,
    agent_id INTEGER,
    scheduled_at TEXT,
    notes TEXT,
    status TEXT DEFAULT 'scheduled',
    created_at TEXT
  )`);
});

function qualify(name) {
  const safe = String(name || 'there').slice(0, 80);
  return `Hi ${safe}! Thanks for reaching out.\n\nQuick questions:\n1) Are you buying or selling?\n2) What is your timeline?\n3) What price range are you targeting?\n\nReply here and I will get you booked.`;
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"');
}

function readCookie(req, name) {
  const raw = req.headers.cookie || '';
  const parts = raw.split(';');
  for (const p of parts) {
    const [k, ...rest] = p.trim().split('=');
    if (k === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

function setAuthCookie(res, token) {
  const secure = isProd ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `onetap_token=${encodeURIComponent(token)}; HttpOnly; Path=/; Max-Age=604800; SameSite=Lax${secure}`
  );
}

function getToken(req) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) return header.slice(7);
  return readCookie(req, 'onetap_token');
}

function authenticateToken(req, res, next) {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: 'No token' });
  jwt.verify(token, JWT_SECRET, (err, agent) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.agent = agent;
    next();
  });
}

function authenticateApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.query.api_key;
  if (!apiKey) return res.status(401).json({ error: 'API key required' });
  db.get('SELECT * FROM agents WHERE api_key = ?', [apiKey], (err, agent) => {
    if (err || !agent) return res.status(401).json({ error: 'Invalid API key' });
    req.agent = agent;
    next();
  });
}

app.post('/register', async (req, res) => {
  if (!rateLimit(`reg:${req.ip}`, 8, 60_000)) return res.status(429).json({ error: 'Too many attempts' });
  try {
    const email = String(req.body.email || '').toLowerCase().trim();
    const password = String(req.body.password || '');
    if (!email.includes('@') || password.length < 8) {
      return res.status(400).json({ error: 'Valid email and password (min 8 chars) required' });
    }
    const hash = await bcrypt.hash(password, 12);
    const apiKey = crypto.randomBytes(24).toString('hex');
    const createdAt = new Date().toISOString();
    db.run(
      'INSERT INTO agents (email, password_hash, api_key, created_at) VALUES (?, ?, ?, ?)',
      [email, hash, apiKey, createdAt],
      function (err) {
        if (err) return res.status(400).json({ error: 'Email already exists' });
        const token = jwt.sign({ id: this.lastID, email }, JWT_SECRET, { expiresIn: '7d' });
        setAuthCookie(res, token);
        res.json({ token, api_key: apiKey, dashboard: '/app' });
      }
    );
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/login', (req, res) => {
  if (!rateLimit(`login:${req.ip}`, 12, 60_000)) return res.status(429).json({ error: 'Too many attempts' });
  const email = String(req.body.email || '').toLowerCase().trim();
  const password = String(req.body.password || '');
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  db.get('SELECT * FROM agents WHERE email = ?', [email], async (err, agent) => {
    if (err || !agent) return res.status(401).json({ error: 'Invalid credentials' });
    const match = await bcrypt.compare(password, agent.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: agent.id, email: agent.email }, JWT_SECRET, { expiresIn: '7d' });
    setAuthCookie(res, token);
    res.json({ token, api_key: agent.api_key, dashboard: '/app' });
  });
});

app.post('/logout', (req, res) => {
  res.setHeader('Set-Cookie', 'onetap_token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax');
  res.json({ ok: true });
});

app.post('/lead', authenticateApiKey, async (req, res) => {
  if (!rateLimit(`lead:${req.agent.id}`, 60, 60_000)) {
    return res.status(429).json({ error: 'Lead rate limit' });
  }
  try {
    const name = String(req.body.name || '').slice(0, 120);
    const phone = String(req.body.phone || '').slice(0, 40);
    const email = String(req.body.email || '').slice(0, 120);
    const source = String(req.body.source || 'webhook').slice(0, 60);
    if (!phone && !email) return res.status(400).json({ error: 'phone or email required' });

    db.run(
      `INSERT INTO leads (agent_id, name, phone, email, source, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'new', ?)`,
      [req.agent.id, name, phone, email, source, new Date().toISOString()]
    );

    const msg = qualify(name || 'there');
    const sent = { sms: false, email: false };
    if (phone && smsClient && TWILIO_FROM) {
      await smsClient.messages.create({ from: TWILIO_FROM, to: phone, body: msg });
      sent.sms = true;
    }
    if (email && SENDGRID_KEY && FROM_EMAIL) {
      await sgMail.send({ to: email, from: FROM_EMAIL, subject: 'Thanks for reaching out!', text: msg });
      sent.email = true;
    }
    res.json({ ok: true, sent });
  } catch (err) {
    console.error('Lead processing error:', err.message);
    res.status(500).json({ ok: false, error: 'Lead processing failed' });
  }
});

app.get('/api/me', authenticateToken, (req, res) => {
  db.get(
    'SELECT id, email, api_key, subscription_status, stripe_customer_id FROM agents WHERE id = ?',
    [req.agent.id],
    (err, row) => {
      if (err || !row) return res.status(404).json({ error: 'Not found' });
      res.json(row);
    }
  );
});

app.get('/api/leads', authenticateToken, (req, res) => {
  db.all(
    'SELECT * FROM leads WHERE agent_id = ? ORDER BY created_at DESC LIMIT 500',
    [req.agent.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'DB error' });
      res.json(rows);
    }
  );
});

app.post('/api/leads/:id/status', authenticateToken, (req, res) => {
  const status = String(req.body.status || '');
  const allowed = ['new', 'contacted', 'qualified', 'booked', 'closed', 'lost'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  db.run(
    'UPDATE leads SET status = ? WHERE id = ? AND agent_id = ?',
    [status, req.params.id, req.agent.id],
    function (err) {
      if (err) return res.status(500).json({ error: 'Update failed' });
      if (!this.changes) return res.status(404).json({ error: 'Lead not found' });
      res.json({ ok: true });
    }
  );
});

app.post('/api/book', authenticateToken, (req, res) => {
  const leadId = req.body.lead_id;
  const scheduledAt = String(req.body.scheduled_at || '');
  const notes = String(req.body.notes || '').slice(0, 500);
  if (!leadId || !scheduledAt) return res.status(400).json({ error: 'lead_id and scheduled_at required' });
  db.get(
    'SELECT id FROM leads WHERE id = ? AND agent_id = ?',
    [leadId, req.agent.id],
    (err, lead) => {
      if (err || !lead) return res.status(404).json({ error: 'Lead not found' });
      db.run(
        'INSERT INTO appointments (lead_id, agent_id, scheduled_at, notes, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [leadId, req.agent.id, scheduledAt, notes, 'scheduled', new Date().toISOString()],
        function (insErr) {
          if (insErr) return res.status(500).json({ error: 'Failed to book' });
          db.run('UPDATE leads SET status = ? WHERE id = ? AND agent_id = ?', ['booked', leadId, req.agent.id]);
          res.json({ ok: true, appointment_id: this.lastID });
        }
      );
    }
  );
});

app.get('/api/daily-summary', authenticateToken, (req, res) => {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  db.all(
    'SELECT * FROM leads WHERE agent_id = ? AND created_at > ?',
    [req.agent.id, yesterday],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'DB error' });
      res.json({
        total_new: rows.length,
        leads: rows,
        message: `You had ${rows.length} new leads in the last 24 hours.`,
      });
    }
  );
});

app.post('/api/checkout', authenticateToken, async (req, res) => {
  if (!stripe || !STRIPE_PRICE_ID) return res.status(503).json({ error: 'Stripe not configured' });
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
      customer_email: req.agent.email,
      success_url: `${APP_URL}/app?paid=1`,
      cancel_url: `${APP_URL}/app?paid=0`,
    });
    res.json({ url: session.url });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/billing-portal', authenticateToken, async (req, res) => {
  if (!stripe) return res.status(503).json({ error: 'Stripe not configured' });
  db.get('SELECT stripe_customer_id FROM agents WHERE id = ?', [req.agent.id], async (err, row) => {
    if (err || !row || !row.stripe_customer_id) {
      return res.status(409).json({ error: 'No Stripe customer yet. Complete checkout first.' });
    }
    try {
      const session = await stripe.billingPortal.sessions.create({
        customer: row.stripe_customer_id,
        return_url: `${APP_URL}/app`,
      });
      res.json({ url: session.url });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
});

app.get('/app', authenticateToken, (req, res) => {
  const email = escapeHtml(req.agent.email);
  res.type('html').send(`<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>ONE TAP CRM</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
body{font-family:system-ui,sans-serif;margin:0;background:#0f0f14;color:#f5f5f5}
header{display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid #222}
main{padding:20px} table{border-collapse:collapse;width:100%;margin-top:16px}
th,td{border:1px solid #333;padding:10px;text-align:left} th{background:#1a1a22}
button{background:#22c55e;color:#041f0f;border:none;padding:8px 14px;border-radius:6px;cursor:pointer;margin:4px;font-weight:600}
.muted{color:#a3a3a3} a{color:#22c55e}
</style></head>
<body>
<header>
  <strong>ONE TAP</strong>
  <span class="muted">${email}</span>
  <span>
    <button type="button" id="pay">Subscribe $99/mo</button>
    <button type="button" id="bill">Billing</button>
    <button type="button" id="out">Log out</button>
  </span>
</header>
<main>
  <p id="me" class="muted"></p>
  <p id="summary" class="muted"></p>
  <button type="button" id="sum">Refresh summary</button>
  <div id="leads"></div>
</main>
<script>
const token = localStorage.getItem('token');
const headers = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (token || '') };
async function j(url, opt){ const r = await fetch(url, opt); return r.json(); }
async function loadMe(){
  const me = await j('/api/me', { headers });
  document.getElementById('me').textContent = 'Status: ' + (me.subscription_status || 'trialing') + ' · API key: ' + (me.api_key || '');
}
async function loadLeads(){
  const leads = await j('/api/leads', { headers });
  let html = '<table><tr><th>Name</th><th>Phone</th><th>Email</th><th>Source</th><th>Status</th><th></th></tr>';
  (leads || []).forEach(l => {
    html += '<tr><td>'+esc(l.name)+'</td><td>'+esc(l.phone)+'</td><td>'+esc(l.email)+'</td><td>'+esc(l.source)+'</td><td>'+esc(l.status)+'</td><td><button data-id="'+l.id+'">Book</button></td></tr>';
  });
  html += '</table>';
  document.getElementById('leads').innerHTML = html;
  document.querySelectorAll('#leads button').forEach(b => b.onclick = () => book(b.dataset.id));
}
function esc(s){ return String(s||'').replace(/[&<>"']/g, c => ({'&':'&','<':'<','>':'>','"':'"',"'":'&#39;'}[c])); }
async function book(id){
  const time = prompt('Appointment time (ISO), e.g. 2026-09-20T15:00:00');
  if (!time) return;
  await j('/api/book', { method:'POST', headers, body: JSON.stringify({ lead_id: Number(id), scheduled_at: time }) });
  loadLeads();
}
document.getElementById('sum').onclick = async () => {
  const data = await j('/api/daily-summary', { headers });
  document.getElementById('summary').textContent = data.message || '';
};
document.getElementById('pay').onclick = async () => {
  const data = await j('/api/checkout', { method:'POST', headers });
  if (data.url) window.location = data.url; else alert(data.error || 'Checkout unavailable');
};
document.getElementById('bill').onclick = async () => {
  const data = await j('/api/billing-portal', { method:'POST', headers });
  if (data.url) window.location = data.url; else alert(data.error || 'Complete checkout first');
};
document.getElementById('out').onclick = async () => {
  await fetch('/logout', { method:'POST' });
  localStorage.removeItem('token');
  window.location = '/site/login.html';
};
loadMe(); loadLeads();
</script></body></html>`);
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'one-tap',
    stripe: Boolean(stripe && STRIPE_PRICE_ID),
    twilio: Boolean(smsClient && TWILIO_FROM),
    sendgrid: Boolean(SENDGRID_KEY && FROM_EMAIL),
    env: isProd ? 'production' : 'development',
    time: new Date().toISOString(),
  });
});

app.get('/', (req, res) => res.redirect('/site/index.html'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`ONE TAP listening on ${PORT}`);
});
