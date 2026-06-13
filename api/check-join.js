const Redis = require('ioredis');
const redis = new Redis(process.env.REDIS_URL);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { token } = req.body || {};
  if (!token) return res.status(400).json({ error: '缺少token' });

  const exists = await redis.exists(`session:${token}`);
  if (!exists) return res.status(404).json({ error: '会话不存在或已过期' });

  // 标记对方已加入
  await redis.hset(`session:${token}`, 'joined', 'true');
  // 设置整个hash的过期时间（续期24小时，确保从加入时开始算）
  await redis.expire(`session:${token}`, 86400);

  // 返回告白内容
  const base = await redis.hget(`session:${token}`, 'base');
  return res.status(200).json({ base });
};