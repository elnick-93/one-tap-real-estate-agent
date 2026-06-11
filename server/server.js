// ONE TAP REAL ESTATE AGENT — PRODUCTION BACKEND
// npm install express body-parser twilio @sendgrid/mail sqlite3 cors

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const twilio = require('twilio');
const sgMail = require('@sendgrid/mail');
const sqlite3 = require('sqlite3').verbose();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// --- CONFIG ---
const TWILIO_SID = process.env.TWILIO_SID || "YOUR_TWILIO_SID";
const TWILIO_TOKEN = process.env.TWILIO_TOKEN || "YOUR_TWILIO_TOKEN";
const TWILIO_FROM = process.env.TWILIO_FROM || "+1XXXXXXXXXX";

const SENDGRID_KEY = process.env.SENDGRID_KEY || "YOUR_SENDGRID_KEY";
const FROM_EMAIL = process.env.FROM_EMAIL || "you@yourdomain.com";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "master123"; // Change this!

sgMail.setApiKey(SENDGRID_KEY);
const sms = twilio(TWILIO_SID, TWILIO_TOKEN);

// --- DB ---
const db = new sqlite3.Database('./data.db');
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    phone TEXT,
    email TEXT,
    source TEXT,
    status TEXT,
    created_at TEXT
  )`);
});

// --- QUALIFICATION MESSAGE ---
function qualify(name) {
  return (
    `Hi ${name || ''}! Thanks for reaching out.\n\n` +
    `Quick questions:\n` +
    `1) Are you buying or selling?\n` +
    `2) What’s your timeline?\n` +
    `3) What price range are you targeting?\n\n` +
    `Reply here and I’ll get you booked for a call or showing.`
  );
}

// --- LEAD INTAKE ---
app.post('/lead', async (req, res) => {
  try {
    const { name, phone, email, source } = req.body;
    const createdAt = new Date().toISOString();

    db.run(
      `INSERT INTO leads (name, phone, email, source, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name || '', phone || '', email || '', source || '', 'new', createdAt]
    );

    const msg = qualify(name || 'there');

    if (phone) {
      await sms.messages.create({
        from: TWILIO_FROM,
        to: phone,
        body: msg
      });
    }

    if (email) {
      await sgMail.send({
        to: email,
        from: FROM_EMAIL,
        subject: "Thanks for reaching out!",
        text: msg
      });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false });
  }
});

// --- ADMIN VIEW (Simple password protect) ---
app.get('/admin/leads', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth || auth !== `Bearer ${ADMIN_PASSWORD}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  db.all(`SELECT * FROM leads ORDER BY created_at DESC`, [], (err, rows) => {
    if (err) return res.status(500).send("Error");
    res.json(rows);
  });
});

// Simple health
app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(3000, () => console.log("ONE TAP Real Estate Agent running on 3000"));