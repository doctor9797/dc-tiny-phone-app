// Cloudflare Worker — Lavender Tiny Phone API
// 部署：注册 Cloudflare → Workers & Pages → 创建 Worker → 粘贴本代码 → 部署
// 然后在 dashboard 中设置环境变量 GEMINI_API_KEY
// 部署后把 Worker URL 填到 public/config.js 的 __API_BASE__

// ── WeAPI 常量 ──
const IV = '0102030405060708';
const PRESET_KEY = '0CoJUm6Qyw8W8jud';
const BASE62 = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

// RSA-1024 公钥
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

const WAPI_ENDPOINTS = {
  'playlist/detail': {
    url: 'https://music.163.com/weapi/v3/playlist/detail',
    buildBody: (p) => ({ id: parseInt(p.id), n: 100000, s: parseInt(p.s) || 1000 }),
  },
  'song/url': {
    url: 'https://music.163.com/weapi/song/enhance/player/url/v1',
    buildBody: (p) => ({
      ids: p.ids ? JSON.stringify(p.ids.split(',').map(Number)) : '[]',
      level: p.level || 'standard', encodeType: 'aac', csrf_token: '',
    }),
  },
  'song/detail': {
    url: 'https://music.163.com/weapi/v3/song/detail',
    buildBody: (p) => {
      const ids = p.ids ? p.ids.split(',').map(Number) : [parseInt(p.id)];
      return { c: JSON.stringify(ids.map(id => ({ id }))), ids: JSON.stringify(ids) };
    },
  },
  'lyric': {
    url: 'https://music.163.com/weapi/song/lyric',
    buildBody: (p) => ({ id: parseInt(p.id), lv: -1, kv: -1, tv: -1, os: 'ios' }),
  },
  'search': {
    url: 'https://music.163.com/weapi/search/get',
    buildBody: (p) => ({ s: p.s || '', type: parseInt(p.type) || 1, limit: parseInt(p.limit) || 10, offset: 0 }),
  },
};

// ── CORS ──
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' } });
}

// ── WeAPI 代理（加密请求网易云）──
async function handleWeAPI(url) {
  const endpoint = url.searchParams.get('endpoint');
  if (!endpoint) return json({ code: -1, msg: 'Missing endpoint' }, 400);
  const cfg = WAPI_ENDPOINTS[endpoint];
  if (!cfg) return json({ code: -1, msg: `Unknown endpoint: ${endpoint}` }, 400);

  const params = {};
  for (const [k, v] of url.searchParams) if (k !== 'endpoint') params[k] = v;
  const encrypted = await weapiEncrypt(cfg.buildBody(params));

  const apiRes = await fetch(cfg.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Referer': 'https://music.163.com/', 'User-Agent': 'Mozilla/5.0' },
    body: new URLSearchParams({ params: encrypted.params, encSecKey: encrypted.encSecKey }).toString(),
  });
  return json(await apiRes.json(), apiRes.status);
}

// ── URL 解析（163cn.tv / music.163.com / bilibili）──
async function handleResolve(url) {
  const targetUrl = url.searchParams.get('url');
  if (!targetUrl) return json({ code: -1, msg: 'Missing url' }, 400);
  const resp = await fetch(targetUrl, { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0' } });
  const finalUrl = resp.url;
  if (finalUrl.includes('music.163.com')) {
    const songMatch = finalUrl.match(/\/song\/(\d+)/) || finalUrl.match(/[?&]id=(\d+)/);
    if (songMatch) return json({ type: 'song', id: songMatch[1], url: finalUrl });
    const plMatch = finalUrl.match(/\/playlist\/(\d+)/) || finalUrl.match(/[?&]id=(\d+)/);
    if (plMatch) return json({ type: 'playlist', id: plMatch[1], url: finalUrl });
  }
  if (finalUrl.includes('bilibili.com')) {
    const bv = finalUrl.match(/BV\w+/);
    if (bv) return json({ type: 'bilibili', id: bv[0], url: finalUrl });
  }
  const hash = finalUrl.split('#')[1] || '';
  const idInHash = hash.match(/\/(\d+)/);
  if (idInHash) return json({ type: hash.includes('playlist') ? 'playlist' : 'song', id: idInHash[1], url: finalUrl });
  return json({ type: 'unknown', id: null, url: finalUrl });
}

// ── 音频代理（解决网易云防盗链）──
async function handleAudioProxy(url) {
  const id = url.searchParams.get('id');
  if (!id) return json({ code: -1, msg: 'Missing id' }, 400);

  const params = { ids: JSON.stringify([parseInt(id)]), level: 'standard', encodeType: 'aac', csrf_token: '' };
  const encrypted = await weapiEncrypt(params);
  const apiRes = await fetch('https://music.163.com/weapi/song/enhance/player/url/v1', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Referer': 'https://music.163.com/', 'User-Agent': 'Mozilla/5.0' },
    body: new URLSearchParams({ params: encrypted.params, encSecKey: encrypted.encSecKey }).toString(),
  });
  const data = await apiRes.json();
  const songUrl = data.data?.[0]?.url;
  if (!songUrl) return json({ code: -1, msg: 'Song URL not available' }, 404);

  const audioRes = await fetch(songUrl, {
    headers: { 'Referer': 'https://music.163.com/', 'User-Agent': 'Mozilla/5.0' },
  });
  if (!audioRes.ok) return json({ code: -1, msg: 'Audio fetch failed' }, 502);

  const hdrs = { ...CORS, 'Content-Type': audioRes.headers.get('content-type') || 'audio/mpeg' };
  if (audioRes.headers.get('content-length')) hdrs['Content-Length'] = audioRes.headers.get('content-length');
  return new Response(audioRes.body, { headers: hdrs });
}

// ── 图片代理（解决网易云防盗链）──
async function handleImageProxy(url) {
  const imgUrl = url.searchParams.get('url');
  if (!imgUrl) return json({ code: -1, msg: 'Missing url' }, 400);
  const imgRes = await fetch(imgUrl, {
    headers: { 'Referer': 'https://music.163.com/', 'User-Agent': 'Mozilla/5.0' },
  });
  if (!imgRes.ok) return json({ code: -1, msg: 'Image fetch failed' }, 502);
  return new Response(imgRes.body, {
    headers: { ...CORS, 'Content-Type': imgRes.headers.get('content-type') || 'image/jpeg', 'Cache-Control': 'public, max-age=86400' },
  });
}

// ── Gemini AI 代理 ──
async function handleChat(request, env) {
  if (request.method !== 'POST') return json({ code: -1, msg: 'Method not allowed' }, 405);
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) return json({ error: '服务端未配置 GEMINI_API_KEY' }, 500);

  const body = await request.json().catch(() => ({}));
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${body.model || 'gemini-2.5-flash'}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: body.contents || [{ role: 'user', parts: [{ text: body.prompt }] }],
        systemInstruction: body.systemInstruction ? { role: 'user', parts: [{ text: body.systemInstruction }] } : undefined,
      }),
    }
  );
  return json(await response.json());
}

// ── 主路由 ──
export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path.startsWith('/api/') || path === '/api') {
        if (path === '/api' || path === '/api/') return await handleWeAPI(url);
        if (path === '/api/play') return await handleAudioProxy(url);
        if (path === '/api/cover') return await handleImageProxy(url);
        if (path === '/api/resolve') return await handleResolve(url);
        if (path === '/api/chat') return await handleChat(request, env);
        if (path === '/api/search') {
          url.searchParams.set('endpoint', 'search');
          return await handleWeAPI(url);
        }
        return json({ code: -1, msg: 'Not found' }, 404);
      }

      // 非 API 请求 → 从 Assets 返回静态文件
      return await env.ASSETS.fetch(request);
    } catch (err) {
      // 如果 Assets 也 404，返回 SPA 入口（支持前端路由）
      try {
        return await env.ASSETS.fetch(new Request(new URL('/index.html', request.url), request));
      } catch {
        return json({ code: -1, msg: err.message }, 500);
      }
    }
  },
};
