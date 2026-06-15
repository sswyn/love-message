const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL);
redis.on('error', (err) => console.error('Redis閿欒:', err));

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const { token } = req.query;
    if (!token || !/^[0-9a-f]{48}$/.test(token)) {
      return res.status(400).json({ error: '鏃犳晥鐨勪細璇濋摼鎺? });
    }

    const exists = await redis.exists(`session:${token}`);
    if (!exists) return res.status(404).json({ error: '浼氳瘽涓嶅瓨鍦ㄦ垨宸茶繃鏈? });

    const joined = (await redis.hget(`session:${token}`, 'joined')) === 'true';
    const messages = await redis.lrange(`messages:${token}`, 0, -1);
    const parsedMessages = messages.map(msg => {
      try { return JSON.parse(msg); } catch (e) { return null; }
    }).filter(Boolean);

    return res.status(200).json({ joined, messages: parsedMessages });
  } catch (err) {
    console.error('鑾峰彇浼氳瘽澶辫触:', err);
    return res.status(500).json({ error: '鏈嶅姟鍣ㄥ唴閮ㄩ敊璇紝璇风◢鍚庨噸璇? });
  }
};
