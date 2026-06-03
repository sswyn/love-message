const crypto = require('crypto');
const Redis = require('ioredis');
const redis = new Redis(process.env.REDIS_URL);

function generateCardKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const getRandomSegment = (length) => {
    let segment = '';
    for (let i = 0; i < length; i++) {
      segment += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return segment;
  };
  return `LOVE-${getRandomSegment(4)}-${getRandomSegment(4)}-${getRandomSegment(4)}`;
}

// 验证 xorpay 回调签名
function verifySign(payload, sign) {
  const computed = crypto.createHmac('sha256', process.env.XORPAY_APP_SECRET)
    .update(payload)
    .digest('hex');
  return computed === sign;
}

module.exports = async (req, res) => {
  try {
    // xorpay 回调是 POST，请求体为 JSON，需要 raw body
    let rawBody = '';
    req.on('data', chunk => rawBody += chunk);
    req.on('end', async () => {
      const sign = req.headers['sign'];
      if (!sign || !verifySign(rawBody, sign)) {
        console.error('签名验证失败');
        return res.status(403).send('sign error');
      }

      let data;
      try {
        data = JSON.parse(rawBody);
      } catch (e) {
        return res.status(400).send('bad json');
      }

      const orderId = data.out_trade_no;
      if (!orderId) return res.status(400).send('missing order id');

      // 检查订单状态，避免重复处理
      const orderStatus = await redis.hget(`order:${orderId}`, 'status');
      if (orderStatus === 'paid') {
        // 已处理，直接返回成功
        return res.status(200).send('success');
      }

      // 生成卡密
      const cardKey = generateCardKey();
      await redis.set(`card:${cardKey}`, '1');  // 存入可用卡密
      await redis.hset(`order:${orderId}`, 'status', 'paid', 'card', cardKey);

      console.log(`订单 ${orderId} 支付成功，卡密：${cardKey}`);
      return res.status(200).send('success');
    });
  } catch (error) {
    console.error('回调处理失败:', error);
    return res.status(500).send('fail');
  }
};