const crypto = require('crypto');
const QRCode = require('qrcode');

const EVENT = {
  name: 'Plantain Boy Experience',
  organizer: 'BLAKMIXED ENT',
  date: '2026-12-27T12:00:00+01:00', // 27 Dec 2026, 12:00 noon WAT
  dateLabel: 'Sunday, 27 December 2026',
  venue: process.env.EVENT_VENUE || 'Western Ahoada County High School',
};

// Single source of truth for prices. Never trust prices sent from the browser.
const TIERS = [
  { id: 'early-bird', name: 'Early Bird', price: 7500, tag: 'Limited release', perks: ['General admission', 'Access to all vendors & food stalls', 'Live music & rave stage'] },
  { id: 'regular', name: 'Regular', price: 10000, tag: 'Most popular', perks: ['General admission', 'Access to all vendors & food stalls', 'Live music & rave stage'] },
  { id: 'high-stool', name: 'High Stool', price: 300000, tag: 'Premium', perks: ['Reserved high-stool seating', 'Priority entry lane', 'Dedicated server'] },
  { id: 'couch', name: 'Couch', price: 500000, tag: 'VIP', perks: ['Private couch lounge area', 'Priority entry lane', 'Bottle & grill service'] },
  { id: 'astronaut', name: 'Astronaut', price: 1000000, tag: 'Ultimate', perks: ['Top-tier VIP experience', 'Best view of the main stage', 'Full hospitality & concierge'] },
];

function secret() {
  return process.env.TICKET_SECRET || process.env.PAYSTACK_SECRET_KEY || 'dev-secret';
}
function ticketCode(reference, index) {
  return 'PBX-' + crypto.createHmac('sha256', secret()).update(`${reference}:${index}`).digest('hex').slice(0, 10).toUpperCase();
}
async function qrPng(text) {
  return QRCode.toBuffer(text, { width: 420, margin: 2, color: { dark: '#000000', light: '#ffffff' } });
}
const naira = (n) => '₦' + Number(n).toLocaleString('en-NG');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function siteUrl(req) {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, '');
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  return `${proto}://${host}`;
}

async function paystack(path, opts = {}) {
  const r = await fetch('https://api.paystack.co' + path, {
    ...opts,
    headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  return r.json();
}

function orderFromTx(d) {
  const m = d.metadata || {};
  const tier = TIERS.find((t) => t.id === m.tier);
  if (!tier || d.status !== 'success') return null;
  const qty = Number(m.qty) || 1;
  if (d.amount !== tier.price * qty * 100) return null; // amount tampering guard
  const reference = d.reference;
  const tickets = [];
  for (let i = 1; i <= qty; i++) tickets.push({ index: i, code: ticketCode(reference, i), qr: `${reference}.${i}.${ticketCode(reference, i)}` });
  return { reference, name: m.name || 'Guest', phone: m.phone || '', email: d.customer && d.customer.email, tier, qty, amount: d.amount / 100, paidAt: d.paid_at || d.paidAt, tickets };
}

// Verifies one transaction with Paystack; returns the order or null if not paid.
async function getPaidOrder(reference) {
  const res = await paystack('/transaction/verify/' + encodeURIComponent(reference));
  if (!res.status || !res.data) return null;
  return orderFromTx(res.data);
}

// Every successful ticket purchase (read straight from Paystack, so nothing depends on buyers returning to the site).
async function listPaidOrders() {
  const orders = [];
  let page = 1, pages = 1;
  do {
    const res = await paystack(`/transaction?status=success&perPage=100&page=${page}`);
    if (!res.status) throw new Error(res.message || 'Paystack error');
    pages = (res.meta && res.meta.pageCount) || 1;
    for (const d of res.data) {
      if (!String(d.reference).startsWith('PBX-')) continue;
      const o = orderFromTx(d);
      if (o) orders.push(o);
    }
    page++;
  } while (page <= pages && page <= 30);
  return orders;
}

// --- Check-in storage (Upstash Redis / Vercel KV REST API; no dependency needed) ---
const REDIS_URL = () => process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const REDIS_TOKEN = () => process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const dbReady = () => !!(REDIS_URL() && REDIS_TOKEN());
async function redis(commands) {
  if (!dbReady()) throw new Error('DB_NOT_CONFIGURED');
  const r = await fetch(REDIS_URL() + '/pipeline', { method: 'POST', headers: { Authorization: 'Bearer ' + REDIS_TOKEN(), 'Content-Type': 'application/json' }, body: JSON.stringify(commands) });
  const j = await r.json();
  if (!r.ok) throw new Error('Redis error');
  return j.map((x) => x.result);
}
const ckKey = (ref, i) => `checkin:${ref}:${i}`;

let _tx;
async function sendEmail({ to, subject, html, attachments }) {
  try {
    if (!_tx) {
      const nodemailer = require('nodemailer');
      _tx = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
      });
    }
    await _tx.sendMail({
      from: `"BLAKMIXED ENT" <${process.env.GMAIL_USER}>`,
      to, subject, html,
      attachments: (attachments || []).map((a) => ({ filename: a.filename, content: Buffer.from(a.content, 'base64'), cid: a.content_id })),
    });
    return true;
  } catch (e) { console.error('Email error', e); return false; }
}

async function sendTicketEmail(order) {
  const attachments = [];
  let cards = '';
  for (const t of order.tickets) {
    const png = await qrPng(t.qr);
    const cid = `qr${t.index}`;
    attachments.push({ filename: `${t.code}.png`, content: png.toString('base64'), content_id: cid });
    cards += `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#111;border:2px dashed #FFC700;border-radius:18px;margin:16px 0">
      <tr>
        <td style="padding:20px;color:#FFF4DC;font-family:Arial,sans-serif">
          <div style="font-size:12px;letter-spacing:2px;color:#FF6A00;font-weight:700">TICKET ${t.index} OF ${order.qty}</div>
          <div style="font-size:26px;font-weight:900;color:#FFC700;margin:6px 0">${esc(order.tier.name)}</div>
          <div style="font-size:14px;color:#ddd">${esc(order.name)}</div>
          <div style="font-size:18px;letter-spacing:3px;margin-top:10px;font-weight:700">${t.code}</div>
        </td>
        <td width="150" style="padding:14px"><img src="cid:${cid}" width="130" height="130" alt="QR ${t.code}" style="border-radius:10px;background:#fff;display:block"></td>
      </tr>
    </table>`;
  }
  const html = `
  <div style="background:#000;padding:28px 12px;font-family:Arial,sans-serif">
    <div style="max-width:600px;margin:0 auto;background:#0b0b0b;border-radius:22px;padding:28px;border:1px solid #222">
            <h1 style="text-align:center;color:#FFC700;font-size:34px;margin:8px 0 2px">Plantain Boy <span style="color:#FF6A00">Experience</span></h1>
      <p style="text-align:center;color:#FFF4DC;margin:0 0 22px">You're in, ${esc(order.name.split(' ')[0])}! </p>
      <p style="color:#ddd;font-size:15px;line-height:1.6">Your payment of <b style="color:#FFC700">${naira(order.amount)}</b> was successful. Show the QR code(s) below at the gate — one code per person.</p>
      ${cards}
      <table role="presentation" width="100%" style="background:#161616;border-radius:14px;margin-top:18px"><tr><td style="padding:16px;color:#FFF4DC;font-size:14px;line-height:1.8">
        <b style="color:#FFC700">Date:</b> ${EVENT.dateLabel}<br>
        <b style="color:#FFC700">Venue:</b> ${esc(EVENT.venue)}<br>
        <b style="color:#FFC700">Reference:</b> ${esc(order.reference)}<br>
        <b style="color:#FFC700">Paid:</b> ${naira(order.amount)} (${order.qty} × ${esc(order.tier.name)})<br>
        <b style="color:#FFC700">Email:</b> ${esc(order.email)}
      </td></tr></table>
      <p style="color:#999;font-size:12px;line-height:1.6;margin-top:20px">Please don't share your QR code — each can only be used once. Bring a valid ID. Questions? Just reply to this email.</p>
      <p style="text-align:center;color:#c9a24a;font-size:12px;margin-top:20px;letter-spacing:1px">PROUDLY SPONSORED BY D’VANITY PREMIUM CLUB PH</p><p style="text-align:center;color:#666;font-size:12px;margin-top:6px">© Plantain Boy Experience</p>
    </div>
  </div>`;
  return sendEmail({ to: order.email, subject: `Your ${order.tier.name} ticket — Plantain Boy Experience`, html, attachments });
}

module.exports = { EVENT, TIERS, ticketCode, getPaidOrder, orderFromTx, listPaidOrders, redis, dbReady, ckKey, sendTicketEmail, sendEmail, paystack, siteUrl, esc, naira, qrPng };
