import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useAppStore } from '../../store';
import { loadVideoFile } from '../../lib/db';
import { Play, Pause, SkipBack, SkipForward, Heart, ChevronDown, GripHorizontal } from 'lucide-react';

const coverColors = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6'];
const POS_KEY = 'floating_player_pos';

const formatTime = (secs: number) => {
  if (!Number.isFinite(secs) || secs < 0) return '00:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

export default function FloatingMusicPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioObjectUrlRef = useRef<string | null>(null);
  const currentSongId = useAppStore((s) => s.musicPlayback.currentSongId);
  const isPlaying = useAppStore((s) => s.musicPlayback.isPlaying);
  const currentTime = useAppStore((s) => s.musicPlayback.currentTime);
  const duration = useAppStore((s) => s.musicPlayback.duration);
  const mode = useAppStore((s) => s.musicPlayback.mode);
  const songs = useAppStore((s) => s.songs);
  const setMusicPlayback = useAppStore((s) => s.setMusicPlayback);
  const togglePlayPause = useAppStore((s) => s.togglePlayPause);
  const nextSongAction = useAppStore((s) => s.nextSong);
  const prevSongAction = useAppStore((s) => s.prevSong);
  const setMusicPlayerMode = useAppStore((s) => s.setMusicPlayerMode);
  const openApp = useAppStore((s) => s.openApp);
  const toggleSongFavorite = useAppStore((s) => s.toggleSongFavorite);
  const currentSong = useMemo(() => songs.find(s => s.id === currentSongId) || null, [songs, currentSongId]);

  // Draggable position
  const [pos, setPos] = useState(() => {
    try { const s = localStorage.getItem(POS_KEY); if (s) return JSON.parse(s); } catch {}
    return { x: 24, y: 200 };
  });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; posX: number; posY: number } | null>(null);

  // Lyrics
  const [lyricLines, setLyricLines] = useState<{ time: number; text: string }[]>([]);
  const [currentLyricIndex, setCurrentLyricIndex] = useState(-1);
  const lyricContainerRef = useRef<HTMLDivElement>(null);

  // Parse lyrics
  useEffect(() => {
    if (!currentSong?.lyrics) { setLyricLines([]); return; }
    const lines = currentSong.lyrics.split('\n');
    const parsed: { time: number; text: string }[] = [];
    for (const line of lines) {
      const match = line.match(/^\[(\d+):(\d+\.\d+)\](.*)/);
      if (match) { const time = parseInt(match[1]) * 60 + parseFloat(match[2]); const text = match[3].trim(); if (text) parsed.push({ time, text }); }
    }
    parsed.sort((a, b) => a.time - b.time);
    setLyricLines(parsed);
    setCurrentLyricIndex(-1);
  }, [currentSong?.lyrics]);

  // Update lyric index
  useEffect(() => {
    if (!lyricLines.length) { setCurrentLyricIndex(-1); return; }
    let idx = -1;
    for (let i = lyricLines.length - 1; i >= 0; i--) { if (currentTime >= lyricLines[i].time) { idx = i; break; } }
    setCurrentLyricIndex(idx);
  }, [currentTime, lyricLines]);

  // Auto-scroll lyrics
  useEffect(() => {
    if (lyricContainerRef.current && currentLyricIndex >= 0) {
      const el = lyricContainerRef.current.children[currentLyricIndex] as HTMLElement;
      if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [currentLyricIndex]);

  // Load audio
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentSong) return;
    let cancelled = false;
    if (currentSong.dbKey) {
      loadVideoFile(currentSong.dbKey).then(blob => {
        if (cancelled || !blob || !audio) return;
        if (audioObjectUrlRef.current) URL.revokeObjectURL(audioObjectUrlRef.current);
        const url = URL.createObjectURL(blob);
        audioObjectUrlRef.current = url;
        audio.src = url;
        if (isPlaying) audio.play().catch(() => {});
      });
    } else if (currentSong.url) {
      audio.src = currentSong.url;
      if (isPlaying) audio.play().catch(() => {});
    }
    return () => { cancelled = true; };
  }, [currentSong?.id]);

  // Play/pause sync
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentSong) return;
    if (isPlaying) { audio.play().catch(() => setMusicPlayback({ isPlaying: false })); }
    else { audio.pause(); }
  }, [isPlaying, currentSong?.id]);

  useEffect(() => {
    return () => { if (audioObjectUrlRef.current) URL.revokeObjectURL(audioObjectUrlRef.current); };
  }, []);

  // Shared drag handler for both modes
  const handleDrag = useCallback((e: PointerEvent) => {
    setIsDragging(true);
    dragRef.current = { startX: e.clientX, startY: e.clientY, posX: pos.x, posY: pos.y };
    const move = (me: PointerEvent) => {
      if (!dragRef.current) return;
      setPos({ x: dragRef.current.posX + me.clientX - dragRef.current.startX, y: dragRef.current.posY + me.clientY - dragRef.current.startY });
    };
    const up = () => {
      setIsDragging(false);
      setPos(prev => { localStorage.setItem(POS_KEY, JSON.stringify(prev)); return prev; });
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  }, [pos.x, pos.y]);

  const handleExpand = () => { if (!isDragging) { openApp('music'); setMusicPlayerMode('full'); } };

  const coverBg = currentSong?.coverUrl || coverColors[(songs.indexOf(currentSong!) + songs.length) % coverColors.length];
  const progress = duration ? (currentTime / duration) * 100 : 0;
  const currentLyricText = currentLyricIndex >= 0 ? lyricLines[currentLyricIndex]?.text : '';

  if (mode === 'hidden' || !currentSongId) return null;

  // ─── Square Mode (vinyl cover + lyrics + controls) ───
  if (mode === 'square') {
    return (
      <>
        <audio ref={audioRef} preload="metadata"
          onTimeUpdate={() => { if (audioRef.current) setMusicPlayback({ currentTime: audioRef.current.currentTime }); }}
          onLoadedMetadata={() => { if (audioRef.current) setMusicPlayback({ duration: audioRef.current.duration }); }}
          onEnded={() => nextSongAction()}
          onPlay={() => setMusicPlayback({ isPlaying: true })}
          onPause={() => setMusicPlayback({ isPlaying: false })}
          onError={() => {}}
        />
        <div
          className="fixed z-50 select-none"
          style={{ left: pos.x, top: pos.y, touchAction: 'none' }}
        >
          {/* Drag handle */}
          <div
            onPointerDown={handleDrag}
            className="flex justify-center mb-1 cursor-grab active:cursor-grabbing"
          >
            <GripHorizontal size={14} className="text-white/40" />
          </div>
          {/* Main card */}
          <div
            onClick={handleExpand}
            className="w-[190px] bg-black/70 backdrop-blur-2xl border border-white/15 rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Vinyl disc cover */}
            <div className="flex justify-center pt-4 pb-2">
              <div className="relative">
                <div
                  className={`w-[120px] h-[120px] rounded-full shadow-xl ${isPlaying ? 'animate-[spin_8s_linear_infinite]' : ''}`}
                  style={{
                    background: `linear-gradient(135deg, #3a3a3a, #111)`,
                    padding: '5px',
                    boxShadow: '0 4px 30px rgba(0,0,0,0.6)',
                  }}
                >
                  <div
                    className="w-full h-full rounded-full bg-cover bg-center"
                    style={{
                      backgroundImage: currentSong?.coverUrl ? `url(${currentSong.coverUrl})` : undefined,
                      backgroundColor: currentSong?.coverUrl ? 'transparent' : coverBg,
                    }}
                  />
                </div>
                {/* Center label */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-7 h-7 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center border border-white/10">
                    <div className="w-2 h-2 rounded-full bg-white/60" />
                  </div>
                </div>
              </div>
            </div>
            {/* Info */}
            <div className="px-3 pb-1 space-y-1">
              <div className="flex items-center justify-between gap-1">
                <span className="text-sm font-semibold text-white truncate">{currentSong?.title || '未知歌曲'}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); if (currentSong) toggleSongFavorite(currentSong.id); }}
                  className="shrink-0"
                >
                  <Heart size={14} className={currentSong?.isFavorite ? 'fill-white text-white' : 'text-white/50'} />
                </button>
              </div>
              <span className="text-[10px] text-white/50 truncate block">{currentSong?.artist}</span>
            </div>
            {/* Scrolling lyrics */}
            <div className="px-3 h-10 overflow-hidden relative">
              <div ref={lyricContainerRef} className="h-full overflow-y-auto scrollbar-hide">
                {lyricLines.length > 0 ? (
                  <div className="text-center text-[11px] leading-5 py-3">
                    {lyricLines.map((line, i) => (
                      <div key={i} className={`transition-all duration-300 ${i === currentLyricIndex ? 'text-white font-medium' : 'text-white/30'}`}>
                        {line.text}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[11px] text-white/30 text-center py-3">暂无歌词</div>
                )}
              </div>
              {/* Gradient fade at edges */}
              <div className="absolute top-0 inset-x-0 h-3 bg-gradient-to-b from-black/70 to-transparent pointer-events-none" />
              <div className="absolute bottom-0 inset-x-0 h-3 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />
            </div>
            {/* Progress bar */}
            <div className="px-3 pb-1">
              <div className="h-0.5 bg-white/15 rounded-full overflow-hidden">
                <div className="h-full bg-white/70 rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
            {/* Controls */}
            <div className="px-3 pb-3 pt-1 flex items-center justify-between">
              <button onClick={(e) => { e.stopPropagation(); prevSongAction(); }} className="text-white/60 hover:text-white p-1">
                <SkipBack size={16} />
              </button>
              <button onClick={(e) => { e.stopPropagation(); togglePlayPause(); }} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors">
                {isPlaying ? <Pause size={14} className="text-white" /> : <Play size={14} className="text-white ml-0.5" />}
              </button>
              <button onClick={(e) => { e.stopPropagation(); nextSongAction(); }} className="text-white/60 hover:text-white p-1">
                <SkipForward size={16} />
              </button>
            </div>
            {/* Mode toggle */}
            <div className="flex justify-center pb-2">
              <div className="flex gap-2 bg-white/10 rounded-full px-2 py-0.5">
                <button onClick={(e) => { e.stopPropagation(); setMusicPlayerMode('bar'); }} className="text-[9px] text-white/50 hover:text-white px-1.5 py-0.5 rounded-full hover:bg-white/10">条形</button>
                <button onClick={(e) => { e.stopPropagation(); setMusicPlayerMode('hidden'); }} className="text-[9px] text-white/50 hover:text-white px-1.5 py-0.5 rounded-full hover:bg-white/10">隐藏</button>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ─── Bar Mode (horizontal bar, wider than tall, no cover) ───
  return (
    <>
      <audio ref={audioRef} preload="metadata"
        onTimeUpdate={() => { if (audioRef.current) setMusicPlayback({ currentTime: audioRef.current.currentTime }); }}
        onLoadedMetadata={() => { if (audioRef.current) setMusicPlayback({ duration: audioRef.current.duration }); }}
        onEnded={() => nextSongAction()}
        onPlay={() => setMusicPlayback({ isPlaying: true })}
        onPause={() => setMusicPlayback({ isPlaying: false })}
        onError={() => {}}
      />
      <div
        className="fixed z-50 select-none"
        style={{ left: pos.x, top: pos.y, touchAction: 'none' }}
      >
        {/* Bar card - simple 4:3 rounded rectangle */}
        <div
          className="w-[280px] h-[210px] bg-black/70 backdrop-blur-2xl border border-white/15 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        >
          {/* Drag handle */}
          <div onPointerDown={handleDrag} className="flex justify-center pt-2 pb-1 cursor-grab active:cursor-grabbing shrink-0">
            <GripHorizontal size={14} className="text-white/40" />
          </div>
          {/* Song title */}
          <div className="px-4 text-center shrink-0" onClick={handleExpand}>
            <div className="text-sm font-semibold text-white truncate">{currentSong?.title || '未知歌曲'}</div>
          </div>
          {/* Lyrics */}
          <div className="flex-1 flex items-center justify-center px-4 min-h-0" onClick={handleExpand}>
            <div className="text-center text-[13px] text-white/60 leading-relaxed line-clamp-2">
              {currentLyricText || '暂无歌词'}
            </div>
          </div>
          {/* Progress bar */}
          <div className="px-4 pb-1 shrink-0">
            <div className="h-1 bg-white/15 rounded-full overflow-hidden">
              <div className="h-full bg-white/70 rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
          {/* Play/pause */}
          <div className="flex justify-center pb-3 shrink-0">
            <button onClick={(e) => { e.stopPropagation(); togglePlayPause(); }} className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors">
              {isPlaying ? <Pause size={14} className="text-white" /> : <Play size={14} className="text-white ml-0.5" />}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
