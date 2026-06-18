const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL);
redis.on('error', (err) => console.error('Redis错误:', err));

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const { token } = req.query;
    if (!token || !/^[0-9a-f]{48}$/.test(token)) {
      return res.status(400).json({ error: '无效的会话链接' });
    }

    const exists = await redis.exists('session:' + token);
    if (!exists) return res.status(404).json({ error: '会话不存在或已过期' });

    const joined = (await redis.hget('session:' + token, 'joined')) === 'true';
    const base = await redis.hget('session:' + token, 'base');
    const agree = await redis.hget('session:' + token, 'agree');
    const refuse = await redis.hget('session:' + token, 'refuse');
    const messages = await redis.lrange('messages:' + token, 0, -1);
    const parsedMessages = messages.map(function(msg) {
      try { return JSON.parse(msg); } catch (e) { return null; }
    }).filter(function(item) { return item !== null; });

    return res.status(200).json({ joined, base, agree, refuse, messages: parsedMessages });
  } catch (err) {
    console.error('获取会话失败:', err);
    return res.status(500).json({ error: '服务器内部错误，请稍后重试' });
  }
};
