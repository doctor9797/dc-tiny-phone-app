// Netease Cloud Music API Proxy — Vercel Serverless Function
// 使用 weapi 加密方案，直接调用 music.163.com（国内可访问）

import CryptoJS from 'crypto-js';
import forge from 'node-forge';

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
    {
      iv: CryptoJS.enc.Utf8.parse(iv),
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    },
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
    buildBody: (params) => ({
      id: parseInt(params.id),
      n: 100000,
      s: parseInt(params.s) || 1000,
    }),
  },
  'song/url': {
    url: 'https://music.163.com/weapi/song/enhance/player/url/v1',
    buildBody: (params) => ({
      ids: params.ids ? JSON.stringify(params.ids.split(',').map(Number)) : '[]',
      level: params.level || 'standard',
      encodeType: 'aac',
      csrf_token: '',
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
    buildBody: (params) => ({
      id: parseInt(params.id),
      lv: -1,
      kv: -1,
      tv: -1,
      os: 'ios',
    }),
  },
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ code: -1, msg: 'Method not allowed' });
  }

  try {
    const url = new URL(req.url, `https://${req.headers.host}`);
    const endpoint = url.searchParams.get('endpoint');

    if (!endpoint) {
      return res.status(400).json({ code: -1, msg: 'Missing endpoint' });
    }

    const config = ENDPOINTS[endpoint];
    if (!config) {
      return res.status(400).json({ code: -1, msg: `Unknown endpoint: ${endpoint}` });
    }

    const params = {};
    for (const [key, value] of url.searchParams) {
      if (key !== 'endpoint') params[key] = value;
    }

    const body = config.buildBody(params);
    const encrypted = weapiEncrypt(body);

    const formBody = new URLSearchParams({
      params: encrypted.params,
      encSecKey: encrypted.encSecKey,
    });

    const apiRes = await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': 'https://music.163.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      body: formBody.toString(),
    });

    const data = await apiRes.json();
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(apiRes.status).json(data);
  } catch (err) {
    return res.status(500).json({ code: -1, msg: err.message });
  }
}
