// Netease Cloud Music API Proxy — Cloudflare Worker
// 部署方法：https://cloudflare.com → Workers & Pages → 创建 Worker → 粘贴本代码 → 部署
// 部署后把 WORKER_URL 填到 src/lib/netease.ts 里

const APP_ID = 'b3010d0000000000d6a4e3fd7e4b9244';

// 私钥 — Cloudflare Workers 的环境变量更安全，这里直接嵌入方便部署
const PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCoh1Ba77VHQKXkO2LmUqiGWd1OfHf4nFqE/DDPi7uaftdfS9Rw1wTtrklnpDX6huM5lqTmqpg2mG0mMIETxa0GytXUU0w5ZfWZqCkb2L2T2p+hQY68vGfR9OeKSe5BPhIva6lMbNeHVoO09L6pdhktofQpkTbROmubkufxdA5nz3oFemaM5kDJvF5eD/LoAB3d3ei5tKxFd2SEkSJg/UBm2OA5Riw5O+cXd7J5n6mnUYM6Kz+j7UqouRif/uaqP/Dbr2l3lraIHo54Kg1s1OTltndSUgDkXZj+KZCdyOE7ZIyv69lJ4sP+/TxXOAnj4VWePiIhraB+KYkgvFd2UU7vAgMBAAECggEAFCQr4dphL3VV/jtsu/soAfqOfPlaOz+wf9FGIh/gmXvMUKrW5m+EOsXIJxdUji79zB2pcpnz3B6GePh2DL9kyPmH6brU0s1RN36F/zp9mcSYrGSR4xOfUtPysi/YxjpdYQZ8ctJVRer8ja1sdgNTygTfkfI1e3cAclTx3IUSzawoBrM1jdvdN3vRg0Mmq+xKTWGSjWMtVT9SEiVQH+dbKsWfiQvgGsCEUbCDLKDrMZEccjm6NmSQm+MGPXs1IrB8mDOeBLrzuONriR7GNzfBrymwQSa6/CjkE9bxxJ20krL4WfanENKkC3X0QQrRF9OFeUIVMRXxwRRvWtNEq7IzjQKBgQDY56EUKuwRNwUzWJgPwabgn9VdINr+5k2B/42cBZlLIHiXJIm6ZpLTaiiA71UuTQnOJF0jZjZ+AY2gpJPaXKQqEjbjNVRk3ZdBB8bgsFE8Oog7juW0VT2A5EExksPPFXvBZVVAnvaGwiyMZrIv/zUiw7xSe8hqn7WRf5bpNogN/QKBgQDG54UWAzY1SBA3dIIJtwK7mDXuQYr/tL4U3vLQdi0Hn3r+r5jtnFGcfKGtR0j3xBocv7V8FXynaSnMMW5DfnezOCINBXNplHZCliTeEMJRY0d8G5K7O1fYiftGj32Bp17dVdTgGZ4tUSUWZ7AGnfkDa2DmTyFfBIpXhExbmpqOWwKBgQC9n5IUnYmPazhisRsO+082pMTVC7ooiZJNCer08XgYU6TZDZpSmQXXScFrJtCjD7p4uxWpstwEwLreK8MObVsfZJkTfTXwkECBG5lkKQB71PfwiXaLdtGz8tiDzDjeu3tbkYk8WzxOh0aG3+j7SPNdFx12RrzpagJD1vVJoODEyQKBgHiwhqqCrGPMJDrh8P2gFIJrq120W3ko3KWhWkhvTIdxl5nuRqb20PZZEWko9feRAB8tnBt8ljSmtPv3imZd2JfgmZi5E/yeXtusaxZrqNzllryRpokBSx5TKyr3ajo/qmo26IJKSRZKRGzB4adCN5SBlTxqC1+yS5cq6YIz31A9AoGAc1ylupZFx5zBed3vp8M0kwnk9MlHv3M5PdNtpwi1eXQ0vSGjSt2kO8Mc/SZDoWG3kLnOppaN/9eAReCxINyhp6m33pbasJCDYdxr/sB1Iq2NaLqiGgUmJfy1ZYNks02KMTN7pebBtAP/Wttruy1i3qSyxoZwXTYKwDJrmulx+iA=
-----END PRIVATE KEY-----`;

function pemToBuffer(pem) {
  const b64 = pem.replace(/-----BEGIN [\w\s]+-----/g, '').replace(/-----END [\w\s]+-----/g, '').replace(/\s/g, '');
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer;
}

function bufToHex(buf) {
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function signRequest(method, pathWithQuery, body, timestamp, nonce) {
  // Netease OpenAPI v2 signing: METHOD\nPATH\nTIMESTAMP\nNONCE\nBODY
  const signStr = [method, pathWithQuery, timestamp, nonce, body || ''].join('\n');
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToBuffer(PRIVATE_KEY),
    { name: 'RSA-SSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign(
    { name: 'RSA-SSA-PKCS1-v1_5' },
    key,
    new TextEncoder().encode(signStr)
  );
  return bufToHex(sig);
}

function randomNonce() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 16; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}

export default {
  async fetch(request) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    try {
      const url = new URL(request.url);
      // 路径格式: /api/{endpoint}?params
      // 例如: /api/playlist/detail/get?playlistId=xxx
      const apiPath = url.pathname.replace(/^\/api\//, '');
      const query = url.search; // includes ?
      const body = request.method === 'POST' ? await request.text() : '';
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const nonce = randomNonce();

      // Build the full path for OpenAPI
      const pathWithQuery = `/openapi/music/basic/${apiPath}${query}`;

      const signature = await signRequest(request.method, pathWithQuery, body, timestamp, nonce);

      const apiUrl = `https://openapi.music.163.com/openapi/music/basic/${apiPath}${query}`;

      const headers = {
        'X-Netease-App-Id': APP_ID,
        'X-Netease-Request-Timestamp': timestamp,
        'X-Netease-Request-Nonce': nonce,
        'X-Netease-Request-Signature': signature,
      };
      if (request.method === 'POST' || body) {
        headers['Content-Type'] = 'application/json; charset=utf-8';
      }

      const apiRes = await fetch(apiUrl, {
        method: request.method,
        headers,
        body: body || undefined,
      });

      const resBody = await apiRes.text();

      return new Response(resBody, {
        status: apiRes.status,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json; charset=utf-8',
        },
      });
    } catch (err) {
      return new Response(JSON.stringify({ code: -1, msg: err.message }), {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json; charset=utf-8',
        },
      });
    }
  },
};
