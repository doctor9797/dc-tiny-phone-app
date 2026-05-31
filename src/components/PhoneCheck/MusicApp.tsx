import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, SkipForward, SkipBack, ChevronDown, Music2, ChevronRight, ChevronLeft } from 'lucide-react';
import { generateAIResponse } from '../../lib/ai';
import { searchSongs } from '../../lib/netease';

/** 网易云封面防盗链代理 */
function proxyCoverUrl(url: string): string {
  if (!url) return '';
  if (/music\.126\.net|p[1-4]\.music/i.test(url)) {
    return `/api/cover?url=${encodeURIComponent(url)}`;
  }
  return url;
}

interface Track {
  id: string;
  title: string;
  artist: string;
  coverUrl: string;
  url: string;
  lyrics: string;
  neteaseId: string;
}

interface Props {
  characterId: string;
  character: { name: string; personality: string; biography?: string };
  onHome: () => void;
  onPlayed: () => void;
}

const SAVED_KEY = 'phone_music_saved_';
const RECENT_KEY = 'phone_music_recent_';
const CACHE_VER = 'phone_music_ver_';
const CACHE_CURRENT = 4; // bump to clear stale covers & urls (v4: use CDN direct URLs instead of /api/play)

function loadSaved(charId: string): Track[] {
  try {
    const ver = localStorage.getItem(CACHE_VER + charId);
    if (ver !== String(CACHE_CURRENT)) {
      // Clear ALL old data for this character
      localStorage.removeItem(SAVED_KEY + charId);
      localStorage.removeItem(RECENT_KEY + charId);
      localStorage.removeItem('phone_music_' + charId);
      localStorage.removeItem('phone_music_tracks_' + charId);
      localStorage.removeItem('phone_check_music_' + charId);
      return [];
    }
    const raw = localStorage.getItem(SAVED_KEY + charId);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveSaved(charId: string, tracks: Track[]) {
  localStorage.setItem(CACHE_VER + charId, String(CACHE_CURRENT));
  localStorage.setItem(SAVED_KEY + charId, JSON.stringify(tracks));
}

interface LyricLine { time: number; text: string; }

function parseLyrics(lrc: string): LyricLine[] {
  if (!lrc) return [];
  const lines: LyricLine[] = [];
  const regex = /\[(\d+):(\d+\.?\d*)\](.*)/g;
  let match;
  while ((match = regex.exec(lrc)) !== null) {
    const min = parseFloat(match[1]);
    const sec = parseFloat(match[2]);
    const text = match[3].trim();
    if (text) lines.push({ time: min * 60 + sec, text });
  }
  return lines;
}

// Cover component — proxied for NetEase anti-hotlink
function CoverImg({ url, className }: { url: string; className: string }) {
  const [showFallback, setShowFallback] = useState(false);
  const proxiedUrl = proxyCoverUrl(url);

  if (!url || showFallback) {
    return <div className={`${className} bg-gradient-to-br from-indigo-500/30 to-purple-600/30`} />;
  }
  return (
    <img
      src={proxiedUrl}
      className={className}
      alt=""
      onError={() => setShowFallback(true)}
    />
  );
}

// AI → search NetEase — 收藏音乐
async function generateAndFetchSavedTracks(charId: string, char: { name: string; personality: string; biography?: string }): Promise<Track[]> {
  const prompt = `根据角色人设，列出${char.name}（性格：${char.personality}）收藏的10首真实歌曲。歌曲必须符合角色性格和身份，根据角色名字判断歌曲语言（西方角色→英文歌，中文角色→中文歌）。歌曲和歌手名保留原文。

以 JSON 数组格式输出，不要markdown代码块：
[
  { "title": "歌曲名", "artist": "歌手名" }
]`;

  let songList: { title: string; artist: string }[] = [];

  try {
    const text = await generateAIResponse(prompt);
    const json = text?.replace(/```json\n?|```\n?/g, '').trim();
    const arr = json ? JSON.parse(json) : null;
    if (Array.isArray(arr) && arr.length > 0) songList = arr.slice(0, 10);
  } catch {}

  if (songList.length === 0) {
    songList = [
      { title: 'Bohemian Rhapsody', artist: 'Queen' },
      { title: 'Hotel California', artist: 'Eagles' },
      { title: 'Billie Jean', artist: 'Michael Jackson' },
      { title: 'Yesterday', artist: 'The Beatles' },
      { title: 'Smells Like Teen Spirit', artist: 'Nirvana' },
    ];
  }

  const results: Track[] = [];
  const seen = new Set<string>();

  for (const s of songList) {
    const key = (s.title + s.artist).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    try {
      const found = await searchSongs(`${s.title} ${s.artist}`, 1);
      if (found.length > 0) {
        const t = found[0];
        results.push({
          id: t.id,
          title: t.title,
          artist: t.artist,
          coverUrl: t.coverUrl || '',
          url: t.url,
          lyrics: t.lyrics || '',
          neteaseId: t.id.replace('netease_', ''),
        });
      }
    } catch {}
    await new Promise(r => setTimeout(r, 300));
  }
  return results;
}

async function generateAndFetchNewSavedTracks(charId: string, char: { name: string; personality: string; biography?: string }, existingNames: string[]): Promise<Track[]> {
  const prompt = `根据角色人设，为${char.name}（性格：${char.personality}）再推荐5首他收藏的其他真实歌曲。要求歌曲必须在网易云音乐上存在，并且不能是以下已有歌曲：${existingNames.join('、')}。歌曲和歌手名保留原文。

以 JSON 数组格式输出，不要markdown代码块：
[
  { "title": "歌曲名", "artist": "歌手名" }
]`;

  let songList: { title: string; artist: string }[] = [];

  try {
    const text = await generateAIResponse(prompt);
    const json = text?.replace(/```json\n?|```\n?/g, '').trim();
    const arr = json ? JSON.parse(json) : null;
    if (Array.isArray(arr) && arr.length > 0) songList = arr.slice(0, 5);
  } catch {}

  if (songList.length === 0) return [];

  const results: Track[] = [];
  const seen = new Set(existingNames.map(n => n.toLowerCase()));

  for (const s of songList) {
    const key = (s.title + s.artist).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    try {
      const found = await searchSongs(`${s.title} ${s.artist}`, 1);
      if (found.length > 0) {
        const t = found[0];
        results.push({
          id: t.id,
          title: t.title,
          artist: t.artist,
          coverUrl: t.coverUrl || '',
          url: t.url,
          lyrics: t.lyrics || '',
          neteaseId: t.id.replace('netease_', ''),
        });
      }
    } catch {}
    await new Promise(r => setTimeout(r, 300));
  }
  return results;
}

async function generateAndFetchRecentTracks(charId: string, char: { name: string; personality: string; biography?: string }): Promise<Track[]> {
  const count = Math.floor(Math.random() * 11) + 10;
  const prompt = `根据角色人设，列出${char.name}（性格：${char.personality}）最近在听的${count}首真实歌曲。歌曲必须符合角色性格和身份，根据角色名字判断歌曲语言（西方角色→英文歌，中文角色→中文歌）。歌曲和歌手名保留原文。

以 JSON 数组格式输出，不要markdown代码块：
[
  { "title": "歌曲名", "artist": "歌手名" }
]`;

  let songList: { title: string; artist: string }[] = [];

  try {
    const text = await generateAIResponse(prompt);
    const json = text?.replace(/```json\n?|```\n?/g, '').trim();
    const arr = json ? JSON.parse(json) : null;
    if (Array.isArray(arr) && arr.length > 0) songList = arr.slice(0, count);
  } catch {}

  if (songList.length === 0) {
    songList = [
      { title: 'Bohemian Rhapsody', artist: 'Queen' },
      { title: 'Hotel California', artist: 'Eagles' },
      { title: 'Billie Jean', artist: 'Michael Jackson' },
      { title: 'Yesterday', artist: 'The Beatles' },
      { title: 'Smells Like Teen Spirit', artist: 'Nirvana' },
    ];
  }

  const results: Track[] = [];
  const seen = new Set<string>();

  for (const s of songList) {
    const key = (s.title + s.artist).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    try {
      const found = await searchSongs(`${s.title} ${s.artist}`, 1);
      if (found.length > 0) {
        const t = found[0];
        results.push({
          id: t.id,
          title: t.title,
          artist: t.artist,
          coverUrl: t.coverUrl || '',
          url: t.url,
          lyrics: t.lyrics || '',
          neteaseId: t.id.replace('netease_', ''),
        });
      }
    } catch {}
    await new Promise(r => setTimeout(r, 300));
  }
  return results;
}

/* ────────── 组件 ────────── */

export default function MusicApp({ characterId, character, onHome, onPlayed }: Props) {
  const [savedTracks, setSavedTracks] = useState<Track[]>(() => loadSaved(characterId));
  const [recentTracks, setRecentTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [screen, setScreen] = useState<'home' | 'saved-list' | 'player' | 'lyrics'>('home');
  const audioRef = useRef<HTMLAudioElement>(null);
  const animRef = useRef<number>(0);
  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const [lyricLines, setLyricLines] = useState<LyricLine[]>([]);
  const prevActiveIdxRef = useRef(-1);

  const userScrollingRef = useRef(false);
  const userScrollTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const tracks = [...savedTracks, ...recentTracks];
  const savedCount = savedTracks.length;
  const currentTrack = tracks[currentIdx] || null;

  const isLyricsMode = screen === 'lyrics';

  // Load tracks on mount
  useEffect(() => {
    const cached = loadSaved(characterId);
    if (cached.length > 0) {
      setSavedTracks(cached);
      setLoading(false);
    }

    (async () => {
      let saved = cached.length > 0 ? cached : [];
      const savedNames = saved.map(t => `${t.title} ${t.artist}`);

      if (saved.length === 0) {
        saved = await generateAndFetchSavedTracks(characterId, character);
        if (saved.length > 0) {
          saveSaved(characterId, saved);
          setSavedTracks(saved);
        }
        setLoading(false);
      } else {
        setLoading(false);
        const newSongs = await generateAndFetchNewSavedTracks(characterId, character, savedNames);
        if (newSongs.length > 0) {
          const updated = [...saved, ...newSongs];
          saveSaved(characterId, updated);
          setSavedTracks(updated);
        }
      }



      const recent = await generateAndFetchRecentTracks(characterId, character);
      if (recent.length > 0) {
        setRecentTracks(recent);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Parse lyrics when track changes
  useEffect(() => {
    setLyricLines(parseLyrics(currentTrack?.lyrics || ''));
    setCurrentTime(0);
    setDuration(0);
    prevActiveIdxRef.current = -1;
  }, [currentTrack]);

  const onTimeUpdate = useCallback(() => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      setDuration(audioRef.current.duration || 0);
    }
    animRef.current = requestAnimationFrame(onTimeUpdate);
  }, []);

  const onAudioPlay = useCallback(() => {
    setPlaying(true);
    onPlayed();
    animRef.current = requestAnimationFrame(onTimeUpdate);
  }, [onTimeUpdate, onPlayed]);

  const onAudioPause = useCallback(() => {
    setPlaying(false);
    cancelAnimationFrame(animRef.current);
  }, []);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(animRef.current);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, []);

  // Auto-scroll lyrics — only when active line index changes
  useEffect(() => {
    if (!lyricsContainerRef.current || lyricLines.length === 0) return;
    if (userScrollingRef.current) return;

    const activeIdx = lyricLines.findIndex((l, i) => {
      const next = lyricLines[i + 1];
      return currentTime >= l.time && (!next || currentTime < next.time);
    });
    if (activeIdx < 0) return;
    if (activeIdx === prevActiveIdxRef.current) return;
    prevActiveIdxRef.current = activeIdx;

    const el = lyricsContainerRef.current.children[activeIdx] as HTMLElement;
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [currentTime, lyricLines]);

  const handleLyricsScroll = useCallback(() => {
    userScrollingRef.current = true;
    if (userScrollTimerRef.current) clearTimeout(userScrollTimerRef.current);
    userScrollTimerRef.current = setTimeout(() => {
      userScrollingRef.current = false;
    }, 3000);
  }, []);

  const playTrack = (idx: number) => {
    if (idx < 0 || idx >= tracks.length) return;
    setCurrentIdx(idx);
    setScreen('player');
    setPlaying(true);
    const audio = audioRef.current;
    if (audio) {
      audio.src = tracks[idx].url;
      audio.play().catch(() => setPlaying(false));
    }
  };

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;
    if (playing) {
      audio.pause();
    } else {
      audio.play().catch(() => setPlaying(false));
    }
  };

  const fmt = (s: number) => {
    if (!s || isNaN(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const activeLyricIdx = lyricLines.findIndex((l, i) => {
    const next = lyricLines[i + 1];
    return currentTime >= l.time && (!next || currentTime < next.time);
  });

  // ──── Loading ────
  if (loading) {
    return (
      <div className="w-full h-full bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-7 h-7 rounded-full border-[1.5px] border-white/20 border-t-white/80 animate-spin" />
          <span className="text-white/30 text-sm tracking-wide">加载音乐...</span>
        </div>
      </div>
    );
  }

  // ──── Empty ────
  if (tracks.length === 0) {
    return (
      <div className="w-full h-full bg-black text-white flex flex-col">
        <div className="flex items-center justify-between px-5 pt-14 pb-2">
          <button onClick={onHome} className="text-[#ff3b30] text-[17px]">返回</button>
          <h1 className="text-[17px] font-semibold">音乐</h1>
          <div className="w-12" />
        </div>
        <div className="flex-1 flex flex-col items-center justify-center" style={{ paddingBottom: '15%' }}>
          <Music2 size={48} className="text-white/20 mb-4" />
          <span className="text-white/30 text-sm">暂无歌曲</span>
        </div>
      </div>
    );
  }

  const coverUrl = currentTrack?.coverUrl || '';

  // ──── Blurred background ────
  const BlurBg = () => (
    coverUrl ? (
      <div className="absolute inset-0">
        <img
          src={proxyCoverUrl(coverUrl)}
          className="absolute inset-0 w-full h-full object-cover"
          alt=""
        />
        <div className="absolute inset-0 backdrop-blur-2xl bg-black/40" />
      </div>
    ) : (
      <div className="absolute inset-0 bg-black" />
    )
  );

  /* ──── Track list row ──── */
  const TrackRow = ({ track, idx, isCompact = false }: { track: Track; idx: number; isCompact?: boolean; key?: string }) => {
    const isCurrent = currentIdx === idx;
    return (
      <button
        onClick={() => playTrack(idx)}
        className={`w-full flex items-center gap-3 active:bg-white/[0.04] transition-colors ${isCompact ? 'px-5 py-2' : 'px-5 py-2.5'}`}
      >
        <div className={`${isCompact ? 'w-10 h-10' : 'w-11 h-11'} rounded-[10px] bg-zinc-800 shrink-0 overflow-hidden relative`}>
          <CoverImg url={track.coverUrl} className="w-full h-full object-cover" />
        </div>
        <div className="min-w-0 flex-1 text-left">
          <div className={`${isCompact ? 'text-[14px]' : 'text-[15px]'} truncate ${isCurrent ? 'text-white' : 'text-white/90'}`}>
            {track.title}
          </div>
          <div className={`${isCompact ? 'text-[12px]' : 'text-[13px]'} text-white/40 truncate`}>{track.artist}</div>
        </div>
        <div className="shrink-0 ml-2 w-5 flex items-center justify-center">
          {isCurrent && playing ? (
            <div className="flex items-end gap-[2.5px] h-3">
              <span className="w-[2.5px] bg-white rounded-full animate-bounce" style={{ height: '55%', animationDelay: '0s' }} />
              <span className="w-[2.5px] bg-white rounded-full animate-bounce" style={{ height: '100%', animationDelay: '0.15s' }} />
              <span className="w-[2.5px] bg-white rounded-full animate-bounce" style={{ height: '40%', animationDelay: '0.3s' }} />
            </div>
          ) : (
            <Play size={isCompact ? 13 : 14} className="text-white/20 ml-0.5" />
          )}
        </div>
      </button>
    );
  };

  /* ══════════════════════════════════════════
     MAIN RENDER
     ══════════════════════════════════════════ */
  return (
    <div className="w-full h-full bg-black text-white overflow-hidden">
      <audio
        ref={audioRef}
        onPlay={onAudioPlay}
        onPause={onAudioPause}
        onEnded={() => playTrack((currentIdx + 1) % tracks.length)}
        onError={() => setPlaying(false)}
        preload="auto"
      />

      {/* ────────── PLAYER / LYRICS ────────── */}
      {(screen === 'player' || screen === 'lyrics') && currentTrack && (
        <div className="absolute inset-0 z-10 flex flex-col bg-black">
          {coverUrl && (
            <div className="absolute inset-0">
              <img
                src={`/api/cover?url=${encodeURIComponent(coverUrl)}`}
                className="absolute inset-0 w-full h-full object-cover opacity-90"
                alt=""
              />
              <div className="absolute inset-0 backdrop-blur-2xl bg-black/40" />
            </div>
          )}

          {/* Header */}
          <div className="relative z-10 flex items-center justify-between px-5 pt-14 pb-2 shrink-0">
            <button
              onClick={() => {
                if (isLyricsMode) { setScreen('player'); return; }
                setScreen('home');
              }}
              className="text-white/70 active:text-white transition-colors"
            >
              <ChevronDown size={22} />
            </button>
            <h1 className="text-[13px] font-semibold tracking-wider text-white/60">
              {isLyricsMode ? '歌词' : '播放中'}
            </h1>
            <div className="w-[22px]" />
          </div>

          {/* ──── LYRICS ──── */}
          {isLyricsMode ? (
            <div className="relative z-10 flex-1 flex flex-col">
              {/* Mini cover + info */}
              <div className="flex items-center gap-3 px-6 pt-2 pb-2 shrink-0">
                <div className="w-10 h-10 rounded-md bg-zinc-800 shrink-0 overflow-hidden shadow-lg relative">
                  <CoverImg url={coverUrl} className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{currentTrack.title}</div>
                  <div className="text-xs text-white/40 truncate">{currentTrack.artist}</div>
                </div>
              </div>

              {/* Lyrics scroll — manual scroll supported; auto-scroll on line change */}
              <div
                ref={lyricsContainerRef}
                className="flex-1 overflow-y-auto px-8"
                style={{ scrollbarWidth: 'none' }}
                onScroll={handleLyricsScroll}
                onTouchMove={handleLyricsScroll}
                onWheel={handleLyricsScroll}
              >
                {lyricLines.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <span className="text-white/20 text-sm">暂无歌词</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center min-h-full pt-8 pb-32">
                    {lyricLines.map((line, i) => {
                      const isActive = i === activeLyricIdx;
                      const dist = Math.abs(i - activeLyricIdx);
                      return (
                        <div
                          key={i}
                          onClick={() => {
                            if (audioRef.current) audioRef.current.currentTime = line.time;
                          }}
                          className="transition-all duration-[400ms] text-center cursor-pointer select-none py-[5px] w-full"
                          style={{
                            fontSize: isActive ? '22px' : dist <= 1 ? '16px' : '14px',
                            fontWeight: isActive ? 600 : 400,
                            color: isActive
                              ? 'rgba(255,255,255,1)'
                              : dist <= 2
                              ? 'rgba(255,255,255,0.45)'
                              : 'rgba(255,255,255,0.18)',
                            lineHeight: isActive ? 1.6 : 1.5,
                          }}
                        >
                          {line.text || '　'}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Mini progress */}
              <div className="relative z-10 px-6 pb-10 shrink-0">
                <div
                  className="w-full h-[2px] bg-white/10 rounded-full cursor-pointer"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const pct = (e.clientX - rect.left) / rect.width;
                    if (audioRef.current && duration > 0) {
                      audioRef.current.currentTime = pct * duration;
                    }
                  }}
                >
                  <div className="h-full bg-white/70 rounded-full" style={{ width: `${progress}%` }} />
                </div>
                <div className="flex justify-between text-[11px] text-white/30 mt-1.5">
                  <span>{fmt(currentTime)}</span>
                  <span>{fmt(duration)}</span>
                </div>
              </div>
            </div>
          ) : (
            /* ──── PLAYER ──── */
            <div className="relative z-10 flex-1 flex flex-col">
              <div className="flex-1" />

              <div className="flex items-center justify-center px-8">
                <div className="w-full max-w-[320px] aspect-square rounded-[14px] bg-zinc-800 overflow-hidden shadow-2xl shadow-black/70 relative">
                  <CoverImg url={coverUrl} className="w-full h-full object-cover" />
                </div>
              </div>

              <div className="flex-1" />

              <div className="px-8 pb-2">
                <h2 className="text-[17px] font-semibold truncate">{currentTrack.title}</h2>
                <p className="text-[14px] text-white/50 mt-0.5 truncate">{currentTrack.artist}</p>
              </div>

              <div className="px-8 pb-1">
                <div
                  className="w-full h-[3px] bg-white/10 rounded-full cursor-pointer group"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const pct = (e.clientX - rect.left) / rect.width;
                    if (audioRef.current && duration > 0) {
                      audioRef.current.currentTime = pct * duration;
                    }
                  }}
                >
                  <div className="h-full bg-white rounded-full transition-all duration-100" style={{ width: `${progress}%` }} />
                </div>
                <div className="flex justify-between text-[11px] text-white/30 mt-1">
                  <span>{fmt(currentTime)}</span>
                  <span>{fmt(duration)}</span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-10 pb-8">
                <button
                  onClick={() => playTrack((currentIdx - 1 + tracks.length) % tracks.length)}
                  className="text-white/60 active:text-white transition-colors"
                >
                  <SkipBack size={24} fill="currentColor" />
                </button>
                <button
                  onClick={togglePlay}
                  className="w-[60px] h-[60px] bg-white rounded-full flex items-center justify-center active:scale-90 transition-transform shadow-lg shadow-white/10"
                >
                  {playing
                    ? <Pause size={22} fill="black" />
                    : <Play size={22} fill="black" className="ml-1" />
                  }
                </button>
                <button
                  onClick={() => playTrack((currentIdx + 1) % tracks.length)}
                  className="text-white/60 active:text-white transition-colors"
                >
                  <SkipForward size={24} fill="currentColor" />
                </button>
              </div>

              <div className="px-8 pb-10 flex items-center justify-center shrink-0">
                <button
                  onClick={() => setScreen('lyrics')}
                  className="flex items-center gap-1.5 text-white/30 text-[13px] active:text-white/60 transition-colors"
                >
                  <Music2 size={14} />
                  <span>歌词</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ────────── HOME ────────── */}
      {screen === 'home' && (
        <div className="w-full h-full flex flex-col">
          <div className="flex items-center justify-between px-5 pt-14 pb-2 shrink-0">
            <button onClick={onHome} className="text-[#ff3b30] text-[17px]">返回</button>
            <h1 className="text-[17px] font-semibold">音乐</h1>
            <div className="w-12" />
          </div>

          <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
            {/* 收藏音乐：横排卡片 */}
            <div className="px-5 pt-2 pb-3">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[15px] font-bold text-white/90">收藏音乐</h2>
                <button
                  onClick={() => setScreen('saved-list')}
                  className="flex items-center gap-0.5 text-white/30 text-[13px] active:text-white/60 transition-colors"
                >
                  <span>查看全部</span>
                  <ChevronRight size={14} />
                </button>
              </div>
              <div
                className="flex gap-3 overflow-x-auto pb-1"
                style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
              >
                {savedTracks.map((track, i) => {
                  const isCurrent = currentIdx === i;
                  return (
                    <button
                      key={track.id}
                      onClick={() => playTrack(i)}
                      className="shrink-0 active:scale-95 transition-transform"
                    >
                      <div className="relative">
                        <div
                          className={`w-[140px] h-[140px] rounded-[14px] overflow-hidden shadow-lg relative
                            ${isCurrent ? 'ring-2 ring-white/40' : ''}`}
                        >
                          <CoverImg url={track.coverUrl} className="w-full h-full object-cover" />
                          {isCurrent && playing && (
                            <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                              <div className="flex items-end gap-[3px] h-5">
                                <span className="w-[3px] bg-white rounded-full animate-bounce" style={{ height: '50%', animationDelay: '0s' }} />
                                <span className="w-[3px] bg-white rounded-full animate-bounce" style={{ height: '100%', animationDelay: '0.15s' }} />
                                <span className="w-[3px] bg-white rounded-full animate-bounce" style={{ height: '40%', animationDelay: '0.3s' }} />
                              </div>
                            </div>
                          )}
                        </div>
                        <p className="text-[12px] font-medium mt-1.5 truncate max-w-[140px] text-white/80">{track.title}</p>
                        <p className="text-[11px] text-white/35 truncate max-w-[140px]">{track.artist}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 最近在听：完整列表 */}
            <div className="px-5 pt-4 pb-2">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-[15px] font-bold text-white/90">最近在听</h2>
                <span className="text-[12px] text-white/25">{recentTracks.length} 首</span>
              </div>
            </div>
            {recentTracks.length > 0 ? (
              <div className="pb-4">
                {recentTracks.map((track, i) => (
                  <TrackRow key={track.id} track={track} idx={savedCount + i} isCompact />
                ))}
              </div>
            ) : (
              <div className="px-5 py-8 text-center text-white/15 text-sm">暂无播放记录</div>
            )}
            <div className="h-20" />
          </div>
        </div>
      )}

      {/* ────────── SAVED LIST VIEW ────────── */}
      {screen === 'saved-list' && (
        <div className="w-full h-full flex flex-col">
          <div className="flex items-center justify-between px-5 pt-14 pb-2 shrink-0">
            <button
              onClick={() => setScreen('home')}
              className="text-white/70 active:text-white transition-colors flex items-center gap-1"
            >
              <ChevronLeft size={20} />
              <span className="text-[17px]">收藏音乐</span>
            </button>
            <span className="text-[13px] text-white/30">{savedTracks.length} 首</span>
          </div>

          <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
            {savedTracks.map((track, i) => (
              <TrackRow key={track.id} track={track} idx={i} />
            ))}
            <div className="h-8" />
          </div>
        </div>
      )}
    </div>
  );
}
