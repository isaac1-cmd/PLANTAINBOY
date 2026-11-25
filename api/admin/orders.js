const authed = require('../_admin');
const { listPaidOrders, redis, dbReady, ckKey } = require('../_lib');
module.exports = async (req, res) => {
  if (!authed(req)) return res.status(401).json({ error: 'Wrong admin key' });
  try {
    const orders = await listPaidOrders();
    const keys = [];
    orders.forEach((o) => o.tickets.forEach((t) => keys.push([o.reference, t.index])));
    let states = keys.map(() => null);
    if (dbReady() && keys.length) {
      for (let i = 0; i < keys.length; i += 500) {
        const slice = keys.slice(i, i + 500);
        const r = await redis([['MGET', ...slice.map(([ref, n]) => ckKey(ref, n))]]);
        r[0].forEach((v, j) => (states[i + j] = v));
      }
    }
    let k = 0;
    const out = orders.map((o) => ({
      reference: o.reference, name: o.name, email: o.email, phone: o.phone, tier: o.tier.name, qty: o.qty, amount: o.amount, paidAt: o.paidAt,
      tickets: o.tickets.map((t) => ({ index: t.index, code: t.code, checkedInAt: states[k++] })),
    }));
    res.json({ dbReady: dbReady(), orders: out });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Could not load orders', detail: e.message }); }
};
