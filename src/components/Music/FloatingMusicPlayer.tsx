import { useState, useEffect, useRef, useMemo } from 'react';
import { useAppStore } from '../../store';
import { loadVideoFile } from '../../lib/db';
import { Play, Pause, SkipBack, SkipForward, X, Disc3, ChevronDown, RectangleHorizontal } from 'lucide-react';

const coverColors = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6'];

export default function FloatingMusicPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioObjectUrlRef = useRef<string | null>(null);
  const currentSongId = useAppStore((s) => s.musicPlayback.currentSongId);
  const isPlaying = useAppStore((s) => s.musicPlayback.isPlaying);
  const mode = useAppStore((s) => s.musicPlayback.mode);
  const songs = useAppStore((s) => s.songs);
  const setMusicPlayback = useAppStore((s) => s.setMusicPlayback);
  const togglePlayPause = useAppStore((s) => s.togglePlayPause);
  const nextSongAction = useAppStore((s) => s.nextSong);
  const prevSongAction = useAppStore((s) => s.prevSong);
  const setMusicPlayerMode = useAppStore((s) => s.setMusicPlayerMode);
  const openApp = useAppStore((s) => s.openApp);
  const currentSong = useMemo(() => songs.find(s => s.id === currentSongId) || null, [songs, currentSongId]);

  // Load audio when currentSong changes
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
    if (isPlaying) {
      audio.play().catch(() => setMusicPlayback({ isPlaying: false }));
    } else {
      audio.pause();
    }
  }, [isPlaying, currentSong?.id]);

  // Cleanup object URL
  useEffect(() => {
    return () => {
      if (audioObjectUrlRef.current) URL.revokeObjectURL(audioObjectUrlRef.current);
    };
  }, []);

  const handleExpand = () => {
    openApp('music');
    setMusicPlayerMode('full');
  };

  const coverBg = currentSong?.coverUrl || coverColors[(songs.indexOf(currentSong!) + songs.length) % coverColors.length];
  const progress = songs.length > 0 ? 0 : 0; // computed from store

  if (mode === 'hidden' || !currentSongId) return null;

  // ─── Square Mode ───
  if (mode === 'square') {
    return (
      <>
        <audio
          ref={audioRef}
          preload="metadata"
          onTimeUpdate={() => {
            if (audioRef.current) setMusicPlayback({ currentTime: audioRef.current.currentTime });
          }}
          onLoadedMetadata={() => {
            if (audioRef.current) setMusicPlayback({ duration: audioRef.current.duration });
          }}
          onEnded={() => nextSongAction()}
          onPlay={() => setMusicPlayback({ isPlaying: true })}
          onPause={() => setMusicPlayback({ isPlaying: false })}
          onError={() => {}}
        />
        <div className="fixed bottom-4 right-4 z-50">
          <button
            onClick={handleExpand}
            className="w-[72px] h-[72px] rounded-2xl bg-black/85 backdrop-blur-xl border border-white/15 shadow-2xl overflow-hidden relative active:scale-95 transition-transform"
          >
            {/* Spinning vinyl */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className={`w-[52px] h-[52px] rounded-full bg-cover bg-center shadow-inner ${isPlaying ? 'animate-spin' : ''}`}
                style={{
                  backgroundImage: currentSong?.coverUrl ? `url(${currentSong.coverUrl})` : undefined,
                  backgroundColor: currentSong?.coverUrl ? 'transparent' : coverBg,
                  animationDuration: '4s',
                }}
              >
                <div className="w-full h-full rounded-full bg-[radial-gradient(circle,_rgba(0,0,0,0.4)_0%,_transparent_60%)]" />
              </div>
            </div>
            {/* Center dot */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-2.5 h-2.5 rounded-full bg-white/80" />
            </div>
          </button>
        </div>
      </>
    );
  }

  // ─── Bar Mode ───
  return (
    <>
      <audio
        ref={audioRef}
        preload="metadata"
        onTimeUpdate={() => {
          if (audioRef.current) setMusicPlayback({ currentTime: audioRef.current.currentTime });
        }}
        onLoadedMetadata={() => {
          if (audioRef.current) setMusicPlayback({ duration: audioRef.current.duration });
        }}
        onEnded={() => nextSongAction()}
        onPlay={() => setMusicPlayback({ isPlaying: true })}
        onPause={() => setMusicPlayback({ isPlaying: false })}
        onError={() => {}}
      />
      <div className="absolute bottom-0 inset-x-0 z-50 px-3 pb-[calc(env(safe-area-inset-bottom)+8px)]">
        <div className="bg-white/88 dark:bg-zinc-900/90 backdrop-blur-2xl rounded-2xl border border-slate-200/50 dark:border-white/10 shadow-2xl overflow-hidden">
          {/* Progress bar */}
          <div className="h-0.5 bg-slate-200/50 dark:bg-white/10">
            <div
              className="h-full bg-slate-600 dark:bg-white/60 transition-all duration-300"
              style={{ width: `${audioRef.current ? (audioRef.current.currentTime / (audioRef.current.duration || 1)) * 100 : 0}%` }}
            />
          </div>

          <div className="flex items-center gap-3 px-4 py-3">
            {/* Cover */}
            <button onClick={handleExpand} className="shrink-0">
              <div
                className="w-10 h-10 rounded-xl bg-cover bg-center shadow-sm"
                style={{
                  backgroundImage: currentSong?.coverUrl ? `url(${currentSong.coverUrl})` : undefined,
                  backgroundColor: currentSong?.coverUrl ? 'transparent' : coverBg,
                }}
              />
            </button>

            {/* Info */}
            <button onClick={handleExpand} className="flex-1 min-w-0 text-left">
              <div className="text-sm font-medium text-slate-800 dark:text-white truncate">
                {currentSong?.title || '未知歌曲'}
              </div>
              <div className="text-xs text-slate-400 dark:text-slate-500 truncate">
                {currentSong?.artist || ''}
              </div>
            </button>

            {/* Controls */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={(e) => { e.stopPropagation(); prevSongAction(); }}
                className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white p-1"
              >
                <SkipBack size={18} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); togglePlayPause(); }}
                className="w-8 h-8 rounded-full bg-slate-800 dark:bg-white text-white dark:text-slate-800 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
              >
                {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); nextSongAction(); }}
                className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white p-1"
              >
                <SkipForward size={18} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMusicPlayerMode('square');
                }}
                className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 p-1 hidden sm:block"
                title="切换为方形模式"
              >
                <RectangleHorizontal size={16} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMusicPlayerMode('hidden');
                }}
                className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 p-1"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
