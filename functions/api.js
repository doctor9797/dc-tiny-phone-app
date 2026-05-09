// Cloudflare Pages Function — Netease Cloud Music weapi proxy
// Same origin as the page, no CORS needed

const IV = '0102030405060708';
const PRESET_KEY = '0CoJUm6Qyw8W8jud';
const BASE62 = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

const RSA_N = BigInt(
  '0xe0b509f6259df8642dbc35662901477df22677ec152b5ff68ace615bb7b725152b' +
  '3ab17a876aea8a5aa76d2e417629ec4ee341f56135fccf695280104e0312ecbda9255' +
  '7c93870114af6c9d05c4f7f0c3685b7a46bee255932575cce10b424d813cfe4875d3e' +
  '82047b97ddef52741d546b8e289dc6935b3ece0462db0a22b8e7'
);
const RSA_E = 65537n;

function modPow(base, exp, mod) {
  let result = 1n;
  base = base % mod;
  while (exp > 0n) {
    if (exp & 1n) result = (result * base) % mod;
    exp >>= 1n;
    base = (base * base) % mod;
  }
  return result;
}

function rsaEncrypt(str) {
  const bytes = new TextEncoder().encode(str);
  let m = 0n;
  for (const b of bytes) m = (m << 8n) | BigInt(b);
  return modPow(m, RSA_E, RSA_N).toString(16).padStart(256, '0');
}

function base64Encode(buf) {
  let binary = '';
  new Uint8Array(buf).forEach(b => binary += String.fromCharCode(b));
  return btoa(binary);
}

async function aesEncrypt(text, key, iv) {
  const keyBuf = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(key),
    { name: 'AES-CBC' }, false, ['encrypt'],
  );
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-CBC', iv: new TextEncoder().encode(iv) },
    keyBuf, new TextEncoder().encode(text),
  );
  return base64Encode(encrypted);
}

function randomSecretKey() {
  let s = '';
  for (let i = 0; i < 16; i++) s += BASE62[Math.floor(Math.random() * 62)];
  return s;
}

async function weapiEncrypt(object) {
  const text = JSON.stringify(object);
  const key = randomSecretKey();
  return {
    params: await aesEncrypt(await aesEncrypt(text, PRESET_KEY, IV), key, IV),
    encSecKey: rsaEncrypt(key.split('').reverse().join('')),
  };
}

const ENDPOINTS = {
  'playlist/detail': {
    url: 'https://music.163.com/weapi/v3/playlist/detail',
    buildBody: (p) => ({ id: parseInt(p.id), n: 100000, s: parseInt(p.s) || 1000 }),
  },
  'song/url': {
    url: 'https://music.163.com/weapi/song/enhance/player/url/v1',
    buildBody: (p) => ({
      ids: p.ids ? JSON.stringify(p.ids.split(',').map(Number)) : '[]',
      level: p.level || 'standard',
      encodeType: 'aac',
      csrf_token: '',
    }),
  },
  'song/detail': {
    url: 'https://music.163.com/weapi/v3/song/detail',
    buildBody: (p) => ({ c: JSON.stringify([{ id: parseInt(p.id) }]) }),
  },
  'lyric': {
    url: 'https://music.163.com/weapi/song/lyric?os=pc',
    buildBody: (p) => ({
      id: parseInt(p.id),
      lv: parseInt(p.lv) || -1,
      kv: parseInt(p.kv) || -1,
      tv: parseInt(p.tv) || -1,
      rv: parseInt(p.rv) || -1,
    }),
  },
};

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const endpoint = url.searchParams.get('endpoint');

  if (!endpoint) {
    return new Response(JSON.stringify({ code: -1, msg: 'Missing endpoint' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const config = ENDPOINTS[endpoint];
  if (!config) {
    return new Response(JSON.stringify({ code: -1, msg: 'Unknown endpoint: ' + endpoint }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const params = {};
    for (const [k, v] of url.searchParams) if (k !== 'endpoint') params[k] = v;

    const encrypted = await weapiEncrypt(config.buildBody(params));

    const apiRes = await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': 'https://music.163.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      body: new URLSearchParams({
        params: encrypted.params,
        encSecKey: encrypted.encSecKey,
      }).toString(),
    });

    const data = await apiRes.json();
    return new Response(JSON.stringify(data), {
      status: apiRes.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ code: -1, msg: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
