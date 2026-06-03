const Redis = require('ioredis');
const redis = new Redis(process.env.REDIS_URL);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  const { phone, code } = req.body || {};
  if (!phone || !code) {
    return res.status(400).json({ error: '缺少手机号或验证码' });
  }
  const storedCode = await redis.get(`sms:${phone}`);
  if (!storedCode) {
    return res.status(400).json({ error: '验证码不存在或已过期' });
  }
  if (storedCode !== code) {
    return res.status(400).json({ error: '验证码错误' });
  }
  await redis.del(`sms:${phone}`);
  return res.status(200).json({ success: true });
};