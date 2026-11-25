const { sendEmail, esc } = require('./_lib');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { business, name, email, phone, category, message } = req.body || {};
  if (!business || !name || !/^\S+@\S+\.\S+$/.test(email || '')) return res.status(400).json({ error: 'Please fill in business, name and a valid email' });
  const to = process.env.ORGANIZER_EMAIL;
  if (!to) return res.status(500).json({ error: 'Not configured' });
  const html = `<h2>New vendor application</h2><p><b>Business:</b> ${esc(business)}<br><b>Contact:</b> ${esc(name)}<br><b>Email:</b> ${esc(email)}<br><b>Phone:</b> ${esc(phone)}<br><b>Category:</b> ${esc(category)}</p><p>${esc(message)}</p>`;
  const ok = await sendEmail({ to, subject: `Vendor application: ${business}`, html });
  res.status(ok ? 200 : 502).json(ok ? { ok: true } : { error: 'Could not send. Try again.' });
};
