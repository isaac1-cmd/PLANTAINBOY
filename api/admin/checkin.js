const authed = require('../_admin');
const { getPaidOrder, ticketCode, redis, dbReady, ckKey } = require('../_lib');
// POST { qr: "REF.1.CODE" }  or  { reference, index }   optional: undo:true
module.exports = async (req, res) => {
  if (!authed(req)) return res.status(401).json({ status: 'error', error: 'Wrong admin key' });
  if (!dbReady()) return res.json({ status: 'error', error: 'Database not connected. Add the Upstash/KV env vars on Vercel.' });
  try {
    let { qr, reference, index, undo } = req.body || {};
    if (qr) {
      const [r, i, c] = String(qr).trim().split('.');
      if (!r || !Number(i) || !c || ticketCode(r, Number(i)) !== c.toUpperCase()) return res.json({ status: 'invalid', error: 'Invalid or fake ticket' });
      reference = r; index = Number(i);
    }
    index = Number(index);
    if (!reference || !index) return res.json({ status: 'invalid', error: 'Invalid ticket' });
    const order = await getPaidOrder(reference);
    if (!order || index > order.qty) return res.json({ status: 'invalid', error: 'No paid ticket found' });
    const info = { name: order.name, tier: order.tier.name, ticket: `${index} of ${order.qty}`, reference };
    const key = ckKey(reference, index);
    if (undo) { await redis([['DEL', key]]); return res.json({ status: 'undone', ...info }); }
    const now = new Date().toISOString();
    const [set] = await redis([['SET', key, now, 'NX']]);
    if (set === 'OK') return res.json({ status: 'ok', checkedInAt: now, ...info });
    const [prev] = await redis([['GET', key]]);
    res.json({ status: 'duplicate', checkedInAt: prev, ...info });
  } catch (e) { console.error(e); res.status(500).json({ status: 'error', error: 'Server error' }); }
};
