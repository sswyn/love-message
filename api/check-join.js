const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL);
redis.on('error', (err) => console.error('Redis错误:', err));

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: '仅支持POST请求' });

  try {
    const { token } = req.body || {};
    if (!token || !/^[0-9a-f]{48}$/.test(token)) {
      return res.status(400).json({ error: '无效的会话链接' });
    }

    const exists = await redis.exists(`session:${token}`);
    if (!exists) return res.status(404).json({ error: '会话不存在或已过期' });

    // 标记对方已加入
    await redis.hset(`session:${token}`, 'joined', 'true');
    await redis.expire(`session:${token}`, 86400);

    const base = await redis.hget(`session:${token}`, 'base');
    const agree = await redis.hget(`session:${token}`, 'agree');
    const refuse = await redis.hget(`session:${token}`, 'refuse');

    return res.status(200).json({ base, agree, refuse });
  } catch (err) {
    console.error('加入会话失败:', err);
    return res.status(500).json({ error: '服务器内部错误，请稍后重试' });
  }
};
