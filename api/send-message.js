const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL);
redis.on('error', (err) => console.error('Redis错误:', err));

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: '仅支持POST请求' });

  try {
    const { token, role, content } = req.body || {};

    if (!token || !/^[0-9a-f]{48}$/.test(token)) {
      return res.status(400).json({ error: '无效的会话链接' });
    }
    if (!role || !['sender', 'receiver'].includes(role)) {
      return res.status(400).json({ error: '无效的角色' });
    }
    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ error: '消息内容不能为空' });
    }
    if (content.length > 500) {
      return res.status(400).json({ error: '消息内容不能超过500字' });
    }

    const exists = await redis.exists('session:' + token);
    if (!exists) return res.status(404).json({ error: '会话不存在或已过期' });

    // rate limit: 30 messages per session per minute
    const limitKey = 'ratelimit:msg:' + token;
    const msgCount = await redis.incr(limitKey);
    if (msgCount === 1) await redis.expire(limitKey, 60);
    if (msgCount > 30) {
      return res.status(429).json({ error: '发送消息过于频繁，请稍后再试' });
    }

    const message = JSON.stringify({ role, content: content.trim(), time: Date.now() });
    await redis.rpush('messages:' + token, message);
    await redis.expire('messages:' + token, 86400);
    await redis.expire('session:' + token, 86400);

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('发送消息失败:', err);
    return res.status(500).json({ error: '服务器内部错误，请稍后重试' });
  }
};