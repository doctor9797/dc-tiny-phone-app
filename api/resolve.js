// Vercel Serverless Function — 网易云短链接解析
// 与 server.js 的 /api/resolve 路由功能相同

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ code: -1, msg: 'Method not allowed' });
  }

  const url = req.query.url;
  if (!url) return res.status(400).json({ code: -1, msg: 'Missing url' });

  try {
    const resp = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0' } });
    const finalUrl = resp.url;
    if (finalUrl.includes('music.163.com')) {
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
}
