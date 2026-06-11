 // ONE TAP REAL ESTATE AGENT — FULL SAAS WITH ALL LAYERS
// npm install express body-parser twilio @sendgrid/mail sqlite3 cors bcryptjs jsonwebtoken stripe

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const twilio = require('twilio');
const sgMail = require('@sendgrid/mail');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const stripe = require('stripe');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public')); // for dashboard

// CONFIG
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret-change-me';
const TWILIO_SID = process.env.TWILIO_SID || 'YOUR_TWILIO_SID';
const TWILIO_TOKEN = process.env.TWILIO_TOKEN || 'YOUR_TWILIO_TOKEN';
const TWILIO_FROM = process.env.TWILIO_FROM || '+1XXXXXXXXXX';
const SENDGRID_KEY = process.env.SENDGRID_KEY || 'YOUR_SENDGRID_KEY';
const FROM_EMAIL = process.env.FROM_EMAIL || 'you@yourdomain.com';
const STRIPE_SECRET = process.env.STRIPE_SECRET || 'sk_test_...';
const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID || 'price_...'; // your $99/mo price
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'master123';

sgMail.setApiKey(SENDGRID_KEY);
const smsClient = twilio(TWILIO_SID, TWILIO_TOKEN);
const stripeClient = stripe(STRIPE_SECRET);

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

// Auth middleware
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

// API key for Zapier / public lead intake
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
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  const hash = await bcrypt.hash(password, 10);
  const apiKey = require('crypto').randomBytes(16).toString('hex');
  const createdAt = new Date().toISOString();
  db.run(
    'INSERT INTO agents (email, password_hash, api_key, created_at) VALUES (?, ?, ?, ?)',
    [email, hash, apiKey, createdAt],
    function(err) {
      if (err) return res.status(400).json({ error: 'Email already exists' });
      const token = jwt.sign({ id: this.lastID, email }, JWT_SECRET, { expiresIn: '7d' });
      res.json({ token, api_key: apiKey, message: 'Account created. Use api_key for Zapier/webhooks. Login with token for dashboard.' });
    }
  );
});

// Login
app.post('/login', (req, res) => {
  const { email, password } = req.body;
  db.get('SELECT * FROM agents WHERE email = ?', [email], async (err, agent) => {
    if (err || !agent) return res.status(401).json({ error: 'Invalid credentials' });
    const match = await bcrypt.compare(password, agent.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: agent.id, email: agent.email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, api_key: agent.api_key });
  });
});

// Lead intake (protected by API key for Zapier)
app.post('/lead', authenticateApiKey, async (req, res) => {
  try {
    const { name, phone, email, source } = req.body;
    const agentId = req.agent.id;
    const createdAt = new Date().toISOString();

    db.run(
      `INSERT INTO leads (agent_id, name, phone, email, source, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [agentId, name || '', phone || '', email || '', source || '', 'new', createdAt]
    );

    const msg = qualify(name || 'there');

    if (phone) {
      await smsClient.messages.create({ from: TWILIO_FROM, to: phone, body: msg });
    }
    if (email) {
      await sgMail.send({ to: email, from: FROM_EMAIL, subject: 'Thanks for reaching out!', text: msg });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false });
  }
});

// Protected dashboard data
app.get('/api/leads', authenticateToken, (req, res) => {
  db.all('SELECT * FROM leads WHERE agent_id = ? ORDER BY created_at DESC', [req.agent.id], (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json(rows);
  });
});

// Book appointment (layer)
app.post('/api/book', authenticateToken, (req, res) => {
  const { lead_id, scheduled_at, notes } = req.body;
  const createdAt = new Date().toISOString();
  db.run(
    'INSERT INTO appointments (lead_id, agent_id, scheduled_at, notes, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [lead_id, req.agent.id, scheduled_at, notes || '', 'scheduled', createdAt],
    function(err) {
      if (err) return res.status(500).json({ error: 'Failed to book' });
      // Send confirmation (simplified)
      res.json({ ok: true, appointment_id: this.lastID });
    }
  );
});

// Daily summary engine (layer) - call this daily via cron or external scheduler
app.get('/api/daily-summary', authenticateToken, (req, res) => {
  const yesterday = new Date(Date.now() - 24*60*60*1000).toISOString();
  db.all(
    'SELECT * FROM leads WHERE agent_id = ? AND created_at > ?',
    [req.agent.id, yesterday],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'DB error' });
      const summary = {
        total_new: rows.length,
        leads: rows,
        message: `You had ${rows.length} new leads in the last 24 hours. Check your dashboard for details.`
      };
      res.json(summary);
      // In prod, send this via email/SMS to the agent
    }
  );
});

// Billing portal (Stripe layer)
app.post('/api/billing-portal', authenticateToken, async (req, res) => {
  try {
    const agent = req.agent;
    // In real flow, store stripe_customer_id on register/checkout
    // For demo, assume you have it or create
    const session = await stripeClient.billingPortal.sessions.create({
      customer: 'cus_demo', // replace with real customer from webhook
      return_url: 'http://127.0.0.1:5000/admin.html'
    });
    res.json({ url: session.url });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Simple protected HTML dashboard (CRM UI layer)
app.get('/admin.html', authenticateToken, (req, res) => {
  res.send(`
    <html><head><title>ONE TAP Dashboard</title><style>body{font-family:system-ui;padding:20px} table{border-collapse:collapse;width:100%} th,td{border:1px solid #ccc;padding:8px} </style></head>
    <body>
      <h1>ONE TAP CRM - Agent ${req.agent.email}</h1>
      <button onclick="window.location='/api/daily-summary'">Get Daily Summary</button>
      <button onclick="createBooking()">Book Appointment</button>
      <button onclick="window.location='/api/billing-portal'">Manage Billing</button>
      <div id="leads"></div>
      <script>
        async function loadLeads() {
          const res = await fetch('/api/leads', { headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') } });
          const leads = await res.json();
          let html = '<table><tr><th>Name</th><th>Phone</th><th>Email</th><th>Source</th><th>Status</th><th>Actions</th></tr>';
          leads.forEach(l => {
            html += `<tr><td>${l.name}</td><td>${l.phone}</td><td>${l.email}</td><td>${l.source}</td><td>${l.status}</td><td><button onclick="bookForLead(${l.id})">Book</button></td></tr>`;
          });
          html += '</table>';
          document.getElementById('leads').innerHTML = html;
        }
        function bookForLead(leadId) {
          const time = prompt('Enter ISO time for appointment (e.g. 2026-06-15T14:00:00Z):');
          if (!time) return;
          fetch('/api/book', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + localStorage.getItem('token') }, body: JSON.stringify({ lead_id: leadId, scheduled_at: time }) }).then(() => loadLeads());
        }
        loadLeads();
      </script>
    </body></html>
  `);
});

// Health
app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(3000, () => console.log('ONE TAP Real Estate Agent (ALL LAYERS) running on 3000'));
