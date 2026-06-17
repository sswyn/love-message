const Redis = require('ioredis');
const crypto = require('crypto');

const redis = new Redis(process.env.REDIS_URL);
redis.on('error', (err) => console.error('Redis错误:', err));

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: '仅支持POST请求' });

  try {
    const { base, agree, refuse } = req.body || {};
    const baseText = (base || '').trim();
    const agreeText = (agree || '').trim();
    const refuseText = (refuse || '').trim();

    if (!baseText) {
      return res.status(400).json({ error: '告白内容不能为空' });
    }
    if (baseText.length > 500) {
      return res.status(400).json({ error: '告白内容不能超过500字' });
    }
    if (agreeText.length > 500) {
      return res.status(400).json({ error: '同意寄语不能超过500字' });
    }
    if (refuseText.length > 500) {
      return res.status(400).json({ error: '拒绝心语不能超过500字' });
    }

    const token = crypto.randomBytes(24).toString('hex');

    await redis.hset('session:' + token, {
      base: baseText,
      agree: agreeText,
      refuse: refuseText,
      joined: 'false',
      created: String(Date.now()),
    });

    await redis.expire('session:' + token, 86400);
    await redis.expire('messages:' + token, 86400);

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const limitKey = 'ratelimit:create:' + ip;
    const count = await redis.incr(limitKey);
    if (count === 1) await redis.expire(limitKey, 60);
    if (count > 3) {
      return res.status(429).json({ error: '操作过于频繁，请稍后再试' });
    }

    return res.status(200).json({ token });
  } catch (err) {
    console.error('创建会话失败:', err);
    return res.status(500).json({ error: '服务器内部错误，请稍后重试' });
  }
};