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
};

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

// ── 静态文件 ──
// 前端构建产物在 dist/ 目录

app.use(express.static(path.join(__dirname, 'dist')));

// 所有非 API 路由返回 index.html（SPA fallback）
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// ── 启动 ──

const PORT = parseInt(process.env.PORT || '3000');
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
