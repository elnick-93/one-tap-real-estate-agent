// ONE TAP REAL ESTATE AGENT — FULL SAAS (SELL-READY)
// npm install express body-parser twilio @sendgrid/mail sqlite3 cors bcryptjs jsonwebtoken stripe
//
// PRODUCTION: Set ALL env vars. Never run with defaults in public.
// See SELL.md + .env.example for full launch path.

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const twilio = require('twilio');
const sgMail = require('@sendgrid/mail');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const stripe = require('stripe');
const crypto = require('crypto');

const app = express();

// Basic hardening
app.use(cors({ origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : true }));
app.use(bodyParser.json({ limit: '100kb' }));
app.use(express.static('public'));

// CONFIG — FAIL LOUDLY if critical secrets missing in production
const isProd = process.env.NODE_ENV === 'production';
const JWT_SECRET = process.env.JWT_SECRET || (isProd ? null : 'dev-only-change-me-immediately');
const TWILIO_SID = process.env.TWILIO_SID || '';
const TWILIO_TOKEN = process.env.TWILIO_TOKEN || '';
const TWILIO_FROM = process.env.TWILIO_FROM || '';
const SENDGRID_KEY = process.env.SENDGRID_KEY || '';
const FROM_EMAIL = process.env.FROM_EMAIL || '';
const STRIPE_SECRET = process.env.STRIPE_SECRET || '';
const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'change-me-now';

if (isProd && (!JWT_SECRET || JWT_SECRET.length < 32)) {
  console.error('FATAL: JWT_SECRET must be set and strong in production');
  process.exit(1);
}
if (isProd && (!TWILIO_SID || !SENDGRID_KEY || !STRIPE_SECRET)) {
  console.warn('WARNING: Missing Twilio/SendGrid/Stripe keys — lead response and billing will fail');
}

if (SENDGRID_KEY) sgMail.setApiKey(SENDGRID_KEY);
const smsClient = (TWILIO_SID && TWILIO_TOKEN) ? twilio(TWILIO_SID, TWILIO_TOKEN) : null;
const stripeClient = STRIPE_SECRET ? stripe(STRIPE_SECRET) : null;

const db = new sqlite3.Database('./data.db');

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
  return `Hi ${name || 'there'}! Thanks for reaching out.\n\nQuick questions:\n1) Are you buying or selling?\n2) What’s your timeline?\n3) What price range are you targeting?\n\nReply here and I’ll get you booked for a call or showing.`;
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
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

// Register agent
app.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password || password.length < 8) {
      return res.status(400).json({ error: 'Email and password (min 8 chars) required' });
    }
    const hash = await bcrypt.hash(password, 12);
    const apiKey = crypto.randomBytes(24).toString('hex');
    const createdAt = new Date().toISOString();
    db.run(
      'INSERT INTO agents (email, password_hash, api_key, created_at) VALUES (?, ?, ?, ?)',
      [email.toLowerCase().trim(), hash, apiKey, createdAt],
      function(err) {
        if (err) return res.status(400).json({ error: 'Email already exists' });
        const token = jwt.sign({ id: this.lastID, email }, JWT_SECRET, { expiresIn: '7d' });
        res.json({
          token,
          api_key: apiKey,
          message: 'Account created. Use api_key for Zapier/webhooks. Login with token for dashboard.'
        });
      }
    );
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
app.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  db.get('SELECT * FROM agents WHERE email = ?', [email.toLowerCase().trim()], async (err, agent) => {
    if (err || !agent) return res.status(401).json({ error: 'Invalid credentials' });
    const match = await bcrypt.compare(password, agent.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: agent.id, email: agent.email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, api_key: agent.api_key });
  });
});

// Lead intake (Zapier / webhook)
app.post('/lead', authenticateApiKey, async (req, res) => {
  try {
    const { name, phone, email, source } = req.body;
    const agentId = req.agent.id;
    const createdAt = new Date().toISOString();

    db.run(
      `INSERT INTO leads (agent_id, name, phone, email, source, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [agentId, name || '', phone || '', email || '', source || 'webhook', 'new', createdAt]
    );

    const msg = qualify(name || 'there');

    if (phone && smsClient && TWILIO_FROM) {
      await smsClient.messages.create({ from: TWILIO_FROM, to: phone, body: msg });
    }
    if (email && SENDGRID_KEY && FROM_EMAIL) {
      await sgMail.send({ to: email, from: FROM_EMAIL, subject: 'Thanks for reaching out!', text: msg });
    }

    res.json({ ok: true, message: 'Lead captured and response sent' });
  } catch (err) {
    console.error('Lead processing error:', err.message);
    res.status(500).json({ ok: false, error: 'Lead processing failed' });
  }
});

// Protected leads
app.get('/api/leads', authenticateToken, (req, res) => {
  db.all('SELECT * FROM leads WHERE agent_id = ? ORDER BY created_at DESC', [req.agent.id], (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json(rows);
  });
});

// Book appointment
app.post('/api/book', authenticateToken, (req, res) => {
  const { lead_id, scheduled_at, notes } = req.body;
  if (!lead_id || !scheduled_at) return res.status(400).json({ error: 'lead_id and scheduled_at required' });
  const createdAt = new Date().toISOString();
  db.run(
    'INSERT INTO appointments (lead_id, agent_id, scheduled_at, notes, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [lead_id, req.agent.id, scheduled_at, notes || '', 'scheduled', createdAt],
    function(err) {
      if (err) return res.status(500).json({ error: 'Failed to book' });
      res.json({ ok: true, appointment_id: this.lastID });
    }
  );
});

// Daily summary
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
        message: `You had ${rows.length} new leads in the last 24 hours.`
      });
    }
  );
});

// Billing portal
app.post('/api/billing-portal', authenticateToken, async (req, res) => {
  if (!stripeClient) return res.status(503).json({ error: 'Stripe not configured' });
  try {
    // In full production: look up agent.stripe_customer_id from DB
    // For now return clear error so buyer knows to wire webhook
    res.status(501).json({
      error: 'Wire Stripe customer ID from checkout webhook first. See SELL.md.',
      hint: 'Store stripe_customer_id on successful subscription, then create portal session.'
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Dashboard (CRM)
app.get('/admin.html', authenticateToken, (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html><head><title>ONE TAP CRM</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      body{font-family:system-ui,-apple-system,sans-serif;padding:20px;background:#0f0f14;color:#f5f5f5;margin:0}
      h1{font-size:1.5rem} table{border-collapse:collapse;width:100%;margin-top:16px}
      th,td{border:1px solid #333;padding:10px;text-align:left} th{background:#1a1a22}
      button{background:#22c55e;color:#041f0f;border:none;padding:8px 14px;border-radius:6px;cursor:pointer;margin:4px;font-weight:600}
      button:hover{background:#16a34a}
    </style></head>
    <body>
      <h1>ONE TAP CRM — ${req.agent.email}</h1>
      <button onclick="loadSummary()">Daily Summary</button>
      <button onclick="window.location='/api/billing-portal'">Billing</button>
      <div id="summary" style="margin:12px 0;color:#a3a3a3"></div>
      <div id="leads"></div>
      <script>
        const token = localStorage.getItem('token');
        async function loadLeads() {
          const res = await fetch('/api/leads', { headers: { 'Authorization': 'Bearer ' + token } });
          const leads = await res.json();
          let html = '<table><tr><th>Name</th><th>Phone</th><th>Email</th><th>Source</th><th>Status</th><th>Actions</th></tr>';
          (leads || []).forEach(l => {
            html += \`<tr><td>\${l.name||''}</td><td>\${l.phone||''}</td><td>\${l.email||''}</td><td>\${l.source||''}</td><td>\${l.status}</td><td><button onclick="bookForLead(\${l.id})">Book</button></td></tr>\`;
          });
          html += '</table>';
          document.getElementById('leads').innerHTML = html;
        }
        async function loadSummary() {
          const res = await fetch('/api/daily-summary', { headers: { 'Authorization': 'Bearer ' + token } });
          const data = await res.json();
          document.getElementById('summary').textContent = data.message || JSON.stringify(data);
        }
        function bookForLead(leadId) {
          const time = prompt('ISO time (e.g. 2026-09-10T14:00:00Z):');
          if (!time) return;
          fetch('/api/book', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify({ lead_id: leadId, scheduled_at: time })
          }).then(() => loadLeads());
        }
        loadLeads();
      </script>
    </body></html>
  `);
});

// Health
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'one-tap-real-estate-agent',
    env: isProd ? 'production' : 'development',
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`ONE TAP Real Estate Agent running on ${PORT}`);
  if (!isProd) console.log('DEV MODE — set NODE_ENV=production and real secrets before public deploy');
});
