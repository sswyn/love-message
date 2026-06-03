const Redis = require('ioredis');
const redis = new Redis(process.env.REDIS_URL);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { orderId } = req.query;
  if (!orderId) return res.status(400).json({ error: '缺少orderId' });

  try {
    const status = await redis.hget(`order:${orderId}`, 'status');
    if (!status) return res.status(404).json({ error: '订单不存在' });

    if (status === 'paid') {
      const card = await redis.hget(`order:${orderId}`, 'card');
      return res.status(200).json({ status: 'paid', card });
    }

    return res.status(200).json({ status });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};