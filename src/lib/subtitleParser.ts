export interface SubtitleEntry {
  index: number;
  start: number;
  end: number;
  text: string;
}

function parseSRT(content: string): SubtitleEntry[] {
  const entries: SubtitleEntry[] = [];
  const blocks = content.trim().replace(/\r/g, '').split(/\n\n+/);
  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 3) continue;
    const index = parseInt(lines[0], 10);
    if (isNaN(index)) continue;
    const m = lines[1].match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{1,3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{1,3})/);
    if (!m) continue;
    const start = +m[1]*3600 + +m[2]*60 + +m[3] + +m[4]/1000;
    const end = +m[5]*3600 + +m[6]*60 + +m[7] + +m[8]/1000;
    const text = lines.slice(2).join('\n').replace(/<[^>]*>/g, '').trim();
    if (text) entries.push({ index, start, end, text });
  }
  return entries;
}

export function parseSubtitle(content: string): SubtitleEntry[] {
  const cleaned = content.replace(/\r/g, '');
  return parseSRT(cleaned.replace(/^WEBVTT.*\n/, ''));
}
