const crypto = require('crypto');
const https = require('https');
const Redis = require('ioredis');
const redis = new Redis(process.env.REDIS_URL);

// xorpay 配置
const XORPAY_APP_ID = process.env.XORPAY_APP_ID;
const XORPAY_APP_SECRET = process.env.XORPAY_APP_SECRET;
const NOTIFY_URL = process.env.XORPAY_NOTIFY_URL; // 必须公网可访问的回调地址，如 https://你的域名/api/payment-callback

// 生成唯一订单号
function generateOrderId() {
  return 'ORDER' + Date.now() + Math.random().toString(36).substr(2, 6);
}

// 请求 xorpay 统一下单
function createXorpayOrder(orderId, price, description) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      appid: XORPAY_APP_ID,
      out_trade_no: orderId,
      total_fee: price,          // 单位：分
      body: description,
      notify_url: NOTIFY_URL,
      // 如需更多参数参考 xorpay 文档
    });

    const sign = crypto.createHmac('sha256', XORPAY_APP_SECRET)
      .update(data)
      .digest('hex');

    const options = {
      hostname: 'xorpay.com',
      port: 443,
      path: '/api/order/create',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'sign': sign,
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          if (result.code === '0') {
            resolve(result.data); // 包含 qrcode_url 等
          } else {
            reject(new Error(result.msg || '创建订单失败'));
          }
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { phone } = req.body || {};

  try {
    const orderId = generateOrderId();
    // 固定价格 1 元 = 100 分
    const price = 100;
    const description = '暮风藏情-告白卡密';

    // 调用 xorpay 创建支付订单
    const payData = await createXorpayOrder(orderId, price, description);

    // 订单信息存入 Redis，有效期30分钟
    await redis.hset(`order:${orderId}`, {
      status: 'pending',
      phone: phone || '',
      createdAt: Date.now(),
    });
    await redis.expire(`order:${orderId}`, 1800);

    // 返回二维码图片链接和订单号
    return res.status(200).json({
      orderId,
      qrcode: payData.qrcode_url,   // xorpay 返回的二维码链接
    });
  } catch (error) {
    console.error('创建订单失败:', error);
    return res.status(500).json({ error: error.message || '创建订单失败' });
  }
};