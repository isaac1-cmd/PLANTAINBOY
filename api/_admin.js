const crypto = require('crypto');
module.exports = function authed(req) {
  const key = String(req.headers['x-admin-key'] || '');
  const real = process.env.ADMIN_KEY || '';
  return real.length > 0 && key.length === real.length && crypto.timingSafeEqual(Buffer.from(key), Buffer.from(real));
};
