const Redis = require('ioredis');
const redis = new Redis(process.env.REDIS_URL);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: '缺少token' });

  const exists = await redis.exists(`session:${token}`);
  if (!exists) return res.status(404).json({ error: '会话不存在或已过期' });

  const joined = (await redis.hget(`session:${token}`, 'joined')) === 'true';
  const messages = await redis.lrange(`messages:${token}`, 0, -1);
  const parsedMessages = messages.map(JSON.parse);

  return res.status(200).json({ joined, messages: parsedMessages });
};