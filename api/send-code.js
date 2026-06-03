const https = require('https');
const Redis = require('ioredis');
const redis = new Redis(process.env.REDIS_URL);

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendSMSBao(phone, code) {
  const username = process.env.SMSBAO_USERNAME;
  const password = process.env.SMSBAO_PASSWORD;
  const content = `您的验证码是${code}，5分钟内有效。【暮风藏情】`;
  const encodedContent = encodeURIComponent(content);
  const url = `https://api.smsbao.com/sms?u=${username}&p=${password}&m=${phone}&c=${encodedContent}`;

  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (data === '0') {
          resolve({ success: true });
        } else {
          reject(new Error(`短信发送失败，错误代码：${data}`));
        }
      });
    }).on('error', reject);
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  const { phone } = req.body || {};
  if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
    return res.status(400).json({ error: '手机号格式不正确' });
  }
  const code = generateCode();
  try {
    await sendSMSBao(phone, code);
    await redis.set(`sms:${phone}`, code, 'EX', 300);
    return res.status(200).json({ message: '验证码已发送' });
  } catch (error) {
    console.error('短信发送失败:', error);
    return res.status(500).json({ error: error.message || '短信发送失败' });
  }
};