const Redis = require('ioredis');
const redis = new Redis(process.env.REDIS_URL);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { card } = req.body || {};
  if (!card) {
    return res.status(400).json({ error: '请输入卡密' });
  }

  // 检查卡密是否存在
  const exists = await redis.exists(`card:${card}`);
  if (!exists) {
    return res.status(400).json({ error: '卡密无效或已使用' });
  }

  // 删除卡密，防止重复使用
  await redis.del(`card:${card}`);
  return res.status(200).json({ success: true });
};