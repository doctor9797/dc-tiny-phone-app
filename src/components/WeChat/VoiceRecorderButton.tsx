import React, { useCallback, useRef, useState } from 'react';
import { LoaderCircle, Mic, Square, X } from 'lucide-react';

export default function VoiceRecorderButton({
  onStartRecording,
  onStopRecording,
  onCancelRecording,
  isEnabled,
}: {
  onStartRecording: () => void;
  onStopRecording: () => void;
  onCancelRecording: () => void;
  isEnabled: boolean;
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const startTimeRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const startPositionRef = useRef({ x: 0, y: 0 });

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startTimer = () => {
    startTimeRef.current = Date.now();
    timerRef.current = window.setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      setRecordingDuration(elapsed);
    }, 100);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!isEnabled) return;
    startPositionRef.current = { x: e.clientX, y: e.clientY };
    setIsRecording(true);
    setIsCanceling(false);
    onStartRecording();
    startTimer();

    const handlePointerUp = () => {
      stopTimer();
      if (!isCanceling) {
        onStopRecording();
      } else {
        onCancelRecording();
      }
      setIsRecording(false);
      setIsCanceling(false);
      setRecordingDuration(0);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointermove', handlePointerMove);
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaY = startPositionRef.current.y - moveEvent.clientY;
      if (deltaY > 50 && !isCanceling) {
        setIsCanceling(true);
      }
    };

    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointermove', handlePointerMove);
  };

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onPointerDown={handlePointerDown}
        disabled={!isEnabled || isRecording}
        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 select-none touch-none transition-all ${
          isRecording
            ? 'bg-red-500 text-white scale-90 shadow-lg'
            : 'bg-white dark:bg-[#2c2c2c] text-slate-700 dark:text-slate-100 active:scale-90'
        } disabled:opacity-50`}
        title={isRecording ? '松开发送' : '按住说话'}
      >
        {isRecording ? (isCanceling ? <X size={18} /> : <Square size={18} />) : <Mic size={18} />}
      </button>

      {isRecording && (
        <div className="fixed inset-x-0 bottom-0 h-1.5 bg-gradient-to-r from-green-400 via-emerald-300 to-green-400 animate-pulse z-50 pointer-events-none" />
      )}

      {isRecording && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className={`absolute inset-0 ${isCanceling ? 'bg-red-500/30' : 'bg-black/50'}`} />
          <div className="relative flex flex-col items-center gap-4">
            <div className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-200 ${
              isCanceling ? 'bg-red-500' : 'bg-red-500 animate-ping opacity-75'
            }`}>
              <div className="w-20 h-20 rounded-full bg-red-500 flex items-center justify-center">
                {isCanceling ? <X size={32} className="text-white" /> : <Square size={32} className="text-white" />}
              </div>
            </div>
            <div className="text-white text-xl font-medium">{formatDuration(recordingDuration)}</div>
            <div className={`text-sm ${isCanceling ? 'text-red-300' : 'text-white/70'}`}>
              {isCanceling ? '松开取消' : '上滑取消，松开发送'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
