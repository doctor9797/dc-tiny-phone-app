// Zeabur/通用部署 — Express 服务器
// 提供静态文件 + 网易云 API 代理 + Gemini API 代理

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import CryptoJS from 'crypto-js';
import forge from 'node-forge';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());

// 当被 Vite dev server 作为中间件导入时（非直接运行），跳过静态文件和服务启动
const isMain = process.argv[1] && (
  process.argv[1].includes('server.js') ||
  process.argv[1].includes('/server')
);

// ── NetEase Weapi 加密 ──

const IV = '0102030405060708';
const PRESET_KEY = '0CoJUm6Qyw8W8jud';
const BASE62 = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDgtQn2JZ34ZC28NWYpAUd98iZ37BUrX/aKzmFbt7clFSs6sXqHauqKWqdtLkF2KexO40H1YTX8z2lSgBBOAxLsvaklV8k4cBFK9snQXE9/DDaFt6Rr7iVZMldczhC0JNgTz+SHXT6CBHuX3e9SdB1Ua44oncaTWz7OBGLbCiK45wIDAQAB
-----END PUBLIC KEY-----`;

function aesEncrypt(text, key, iv) {
  return CryptoJS.AES.encrypt(
    CryptoJS.enc.Utf8.parse(text),
    CryptoJS.enc.Utf8.parse(key),
    { iv: CryptoJS.enc.Utf8.parse(iv), mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 },
  ).toString();
}

function rsaEncrypt(str) {
  const publicKey = forge.pki.publicKeyFromPem(PUBLIC_KEY);
  const encrypted = publicKey.encrypt(str, 'NONE');
  return forge.util.bytesToHex(encrypted);
}

function weapiEncrypt(object) {
  const text = JSON.stringify(object);
  let secretKey = '';
  for (let i = 0; i < 16; i++) {
    secretKey += BASE62.charAt(Math.round(Math.random() * 61));
  }
  return {
    params: aesEncrypt(aesEncrypt(text, PRESET_KEY, IV), secretKey, IV),
    encSecKey: rsaEncrypt(secretKey.split('').reverse().join('')),
  };
}

const ENDPOINTS = {
  'playlist/detail': {
    url: 'https://music.163.com/weapi/v3/playlist/detail',
    buildBody: (params) => ({ id: parseInt(params.id), n: 100000, s: parseInt(params.s) || 1000 }),
  },
  'song/url': {
    url: 'https://music.163.com/weapi/song/enhance/player/url/v1',
    buildBody: (params) => ({
      ids: params.ids ? JSON.stringify(params.ids.split(',').map(Number)) : '[]',
      level: params.level || 'standard', encodeType: 'aac', csrf_token: '',
    }),
  },
  'song/detail': {
    url: 'https://music.163.com/weapi/v3/song/detail',
    buildBody: (params) => {
      const ids = params.ids ? params.ids.split(',').map(Number) : [parseInt(params.id)];
      return {
        c: JSON.stringify(ids.map(id => ({ id }))),
        ids: JSON.stringify(ids),
      };
    },
  },
  'lyric': {
    url: 'https://music.163.com/weapi/song/lyric',
    buildBody: (params) => ({ id: parseInt(params.id), lv: -1, kv: -1, tv: -1, os: 'ios' }),
  },
  'search': {
    url: 'https://music.163.com/weapi/search/get',
    buildBody: (params) => ({ s: params.s || '', type: parseInt(params.type) || 1, limit: parseInt(params.limit) || 10, offset: parseInt(params.offset) || 0 }),
  },
};

// ── 路由: 网易云短链接解析 ──

app.get('/api/resolve', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ code: -1, msg: 'Missing url' });

  try {
    const resp = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0' } });
    const finalUrl = resp.url;
    if (finalUrl.includes('music.163.com')) {
      const urlObj = new URL(finalUrl);
      // 检查是否是歌曲
      const songMatch = finalUrl.match(/\/song\/(\d+)/) || finalUrl.match(/[?&]id=(\d+)/);
      if (songMatch) return res.json({ type: 'song', id: songMatch[1], url: finalUrl });
      // 检查是否是歌单
      const playlistMatch = finalUrl.match(/\/playlist\/(\d+)/) || finalUrl.match(/[?&]id=(\d+)/);
      if (playlistMatch) return res.json({ type: 'playlist', id: playlistMatch[1], url: finalUrl });
    }
    if (finalUrl.includes('bilibili.com')) {
      const bvMatch = finalUrl.match(/BV\w+/);
      if (bvMatch) return res.json({ type: 'bilibili', id: bvMatch[0], url: finalUrl });
    }
    // 从hash里提取
    const hash = finalUrl.split('#')[1] || '';
    const idInHash = hash.match(/\/(\d+)/);
    if (idInHash) return res.json({ type: hash.includes('playlist') ? 'playlist' : 'song', id: idInHash[1], url: finalUrl });

    res.json({ type: 'unknown', id: null, url: finalUrl });
  } catch (err) {
    res.status(500).json({ code: -1, msg: err.message });
  }
});

// ── 路由: 网易云 API 代理 ──

app.get('/api', async (req, res) => {
  const endpoint = req.query.endpoint;
  if (!endpoint) return res.status(400).json({ code: -1, msg: 'Missing endpoint' });

  const config = ENDPOINTS[endpoint];
  if (!config) return res.status(400).json({ code: -1, msg: `Unknown endpoint: ${endpoint}` });

  try {
    const params = { ...req.query };
    delete params.endpoint;

    const body = config.buildBody(params);
    const encrypted = weapiEncrypt(body);
    const formBody = new URLSearchParams({ params: encrypted.params, encSecKey: encrypted.encSecKey });

    const apiRes = await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': 'https://music.163.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      body: formBody.toString(),
    });

    const data = await apiRes.json();
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(apiRes.status).json(data);
  } catch (err) {
    return res.status(500).json({ code: -1, msg: err.message });
  }
});

// ── 路由: 音频代理（解决网易云防盗链）──

app.get('/api/play', async (req, res) => {
  const id = req.query.id;
  if (!id) return res.status(400).json({ code: -1, msg: 'Missing id' });

  try {
    // 先获取真实播放地址
    const params = { ids: JSON.stringify([parseInt(id)]), level: 'standard', encodeType: 'aac', csrf_token: '' };
    const encrypted = weapiEncrypt(params);
    const formBody = new URLSearchParams({ params: encrypted.params, encSecKey: encrypted.encSecKey });

    const apiRes = await fetch('https://music.163.com/weapi/song/enhance/player/url/v1', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': 'https://music.163.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      body: formBody.toString(),
    });

    const data = await apiRes.json();
    const songUrl = data.data?.[0]?.url;
    if (!songUrl) return res.status(404).json({ code: -1, msg: 'Song URL not available' });

    // 代理音频流（绕过防盗链）
    const audioRes = await fetch(songUrl, {
      headers: {
        'Referer': 'https://music.163.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!audioRes.ok) return res.status(502).json({ code: -1, msg: 'Audio fetch failed' });

    // 转发音频流（流式转发，兼容 Web ReadableStream）
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', audioRes.headers.get('content-type') || 'audio/mpeg');
    if (audioRes.headers.get('content-length')) {
      res.setHeader('Content-Length', audioRes.headers.get('content-length'));
    }
    for await (const chunk of audioRes.body) {
      res.write(chunk);
    }
    res.end();
  } catch (err) {
    res.status(500).json({ code: -1, msg: err.message });
  }
});

// ── 路由: 封面图片代理（解决网易云防盗链）──

app.get('/api/cover', async (req, res) => {
  const imgUrl = req.query.url;
  if (!imgUrl) return res.status(400).json({ code: -1, msg: 'Missing url' });

  try {
    const imgRes = await fetch(imgUrl, {
      headers: {
        'Referer': 'https://music.163.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!imgRes.ok) return res.status(502).json({ code: -1, msg: 'Image fetch failed' });

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', imgRes.headers.get('content-type') || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
    res.end(imgBuffer);
  } catch (err) {
    res.status(500).json({ code: -1, msg: err.message });
  }
});

// ── 路由: 搜索歌曲 ──

app.get('/api/search', async (req, res) => {
  const keywords = req.query.keywords;
  if (!keywords) return res.status(400).json({ code: -1, msg: 'Missing keywords' });

  try {
    const encrypted = weapiEncrypt({ s: keywords, type: 1, limit: parseInt(req.query.limit) || 10, offset: 0 });
    const formBody = new URLSearchParams({ params: encrypted.params, encSecKey: encrypted.encSecKey });

    const apiRes = await fetch('https://music.163.com/weapi/search/get', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': 'https://music.163.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      body: formBody.toString(),
    });

    const data = await apiRes.json();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json(data);
  } catch (err) {
    res.status(500).json({ code: -1, msg: err.message });
  }
});

// ── 路由: Gemini API 代理 ──
// 前端 AI 请求走这里，API Key 留在服务端不暴露给客户端

app.post('/api/chat', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: '服务端未配置 GEMINI_API_KEY' });
  }

  const { model, contents, systemInstruction } = req.body;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-2.5-flash'}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: contents || [{ role: 'user', parts: [{ text: req.body.prompt }] }],
          systemInstruction: systemInstruction ? { role: 'user', parts: [{ text: systemInstruction }] } : undefined,
        }),
      }
    );

    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 静态文件（仅生产模式，Vite dev 模式下由 Vite 自己处理） ──

if (isMain) {
  // 带 hash 的静态资源（在 assets/ 里）—— 长期缓存
  app.use('/assets', express.static(path.join(__dirname, 'dist', 'assets'), {
    maxAge: '30d',
    immutable: true,
  }));
  // 塔罗牌图片 —— 长期缓存
  app.use('/tarot-cards', express.static(path.join(__dirname, 'dist', 'tarot-cards'), {
    maxAge: '30d',
    immutable: true,
  }));
  // 其他静态文件（图标、音频等）—— 短期缓存
  app.use(express.static(path.join(__dirname, 'dist'), {
    maxAge: '1d',
  }));
  // 所有非 API 路由返回 index.html（SPA fallback）
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

// 当被 Vite 作为中间件使用时，未匹配的路由继续传递
app.use((_req, _res, next) => next());

// ── 启动（仅直接运行时） ──

if (isMain) {
  const PORT = parseInt(process.env.PORT || '3000');
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

export default app;
