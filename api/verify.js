const { getPaidOrder, sendTicketEmail, qrPng } = require('./_lib');
// Called by success.html after Paystack redirects back. Sends the ticket email once.
module.exports = async (req, res) => {
  try {
    const reference = req.query.reference || req.query.trxref;
    if (!reference) return res.status(400).json({ error: 'Missing reference' });
    const order = await getPaidOrder(reference);
    if (!order) return res.status(402).json({ error: 'Payment not confirmed yet' });
    // Email only on the first confirmation (the page passes send=1 once per browser session)
    if (req.query.send === '1') await sendTicketEmail(order);
    const tickets = [];
    for (const t of order.tickets) tickets.push({ index: t.index, code: t.code, qr: 'data:image/png;base64,' + (await qrPng(t.qr)).toString('base64') });
    res.json({ name: order.name, email: order.email, tier: order.tier.name, qty: order.qty, amount: order.amount, reference, tickets });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
};
