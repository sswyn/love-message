const Redis = require('ioredis');
const redis = new Redis(process.env.REDIS_URL);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { token, role, content } = req.body || {};
  if (!token || !role || !content) return res.status(400).json({ error: '参数错误' });

  const exists = await redis.exists(`session:${token}`);
  if (!exists) return res.status(404).json({ error: '会话不存在或已过期' });

  const message = JSON.stringify({ role, content, time: Date.now() });
  await redis.rpush(`messages:${token}`, message);
  // 设置消息列表过期时间（24小时）
  await redis.expire(`messages:${token}`, 86400);
  // 同时续期会话的过期时间
  await redis.expire(`session:${token}`, 86400);

  return res.status(200).json({ success: true });
};