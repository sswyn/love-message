const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL);
redis.on('error', (err) => console.error('Redis閿欒:', err));

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: '浠呮敮鎸丳OST璇锋眰' });

  try {
    const { token, role, content } = req.body || {};

    if (!token || !/^[0-9a-f]{48}$/.test(token)) {
      return res.status(400).json({ error: '鏃犳晥鐨勪細璇濋摼鎺? });
    }
    if (!role || !['sender', 'receiver'].includes(role)) {
      return res.status(400).json({ error: '鏃犳晥鐨勮鑹? });
    }
    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ error: '娑堟伅鍐呭涓嶈兘涓虹┖' });
    }
    if (content.length > 500) {
      return res.status(400).json({ error: '娑堟伅鍐呭涓嶈兘瓒呰繃500瀛? });
    }

    const exists = await redis.exists(`session:${token}`);
    if (!exists) return res.status(404).json({ error: '浼氳瘽涓嶅瓨鍦ㄦ垨宸茶繃鏈? });

    // rate limit: 30 messages per session per minute
    const limitKey = `ratelimit:msg:${token}`;
    const msgCount = await redis.incr(limitKey);
    if (msgCount === 1) await redis.expire(limitKey, 60);
    if (msgCount > 30) {
      return res.status(429).json({ error: '鍙戦€佽繃浜庨绻侊紝璇风◢鍚庡啀璇? });
    }

    const message = JSON.stringify({ role, content: content.trim(), time: Date.now() });
    await redis.rpush(`messages:${token}`, message);
    await redis.expire(`messages:${token}`, 86400);
    await redis.expire(`session:${token}`, 86400);

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('鍙戦€佹秷鎭け璐?', err);
    return res.status(500).json({ error: '鏈嶅姟鍣ㄥ唴閮ㄩ敊璇紝璇风◢鍚庨噸璇? });
  }
};

