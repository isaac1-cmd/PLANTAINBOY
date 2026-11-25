const { TIERS, paystack, siteUrl } = require('./_lib');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { name, email, phone, tier: tierId, qty } = req.body || {};
    const tier = TIERS.find((t) => t.id === tierId);
    const q = Math.floor(Number(qty));
    if (!tier) return res.status(400).json({ error: 'Invalid ticket type' });
    if (!q || q < 1 || q > 10) return res.status(400).json({ error: 'Quantity must be 1-10' });
    if (!name || name.trim().length < 2) return res.status(400).json({ error: 'Please enter your full name' });
    if (!/^\S+@\S+\.\S+$/.test(email || '')) return res.status(400).json({ error: 'Please enter a valid email' });
    if (!/^[+\d][\d\s-]{6,}$/.test(phone || '')) return res.status(400).json({ error: 'Please enter a valid phone number' });

    const reference = `PBX-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`.toUpperCase();
    const out = await paystack('/transaction/initialize', {
      method: 'POST',
      body: JSON.stringify({
        email: email.trim(),
        amount: tier.price * q * 100, // kobo, computed on the server
        currency: 'NGN',
        reference,
        callback_url: `${siteUrl(req)}/success.html`,
        metadata: { name: name.trim(), phone: phone.trim(), tier: tier.id, qty: q, custom_fields: [{ display_name: 'Ticket', variable_name: 'ticket', value: `${tier.name} x${q}` }] },
      }),
    });
    if (!out.status) return res.status(502).json({ error: out.message || 'Could not start payment' });
    res.json({ url: out.data.authorization_url, reference });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
};
