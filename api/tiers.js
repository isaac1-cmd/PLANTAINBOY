const { TIERS, EVENT } = require('./_lib');
module.exports = (req, res) => {
  res.setHeader('Cache-Control', 's-maxage=60');
  res.json({ event: EVENT, tiers: TIERS });
};
