import { useEffect, useRef } from 'react';
import { useAppStore } from '../../store';

interface Props {
  characterId: string;
  onFinish: (characterId: string) => void;
  onGrabBack: (characterId: string) => void;
}

/**
 * 全屏遮罩层。只拦截触摸/点击，用户完全能看到手机内容。
 * 45 秒后自动回调 onFinish。
 */
export default function CharacterPhoneCheckOverlay({ characterId, onFinish, onGrabBack }: Props) {
  const charName = useAppStore(s => s.characters[characterId]?.name || '对方');

  const onFinishRef = useRef(onFinish);
  const onGrabBackRef = useRef(onGrabBack);
  onFinishRef.current = onFinish;
  onGrabBackRef.current = onGrabBack;

  useEffect(() => {
    const timer = setTimeout(() => onFinishRef.current(characterId), 45000);
    return () => clearTimeout(timer);
  }, [characterId]);

  return (
    <div
      className="fixed inset-0 z-[10000]"
      style={{ pointerEvents: 'auto', cursor: 'not-allowed' }}
      onContextMenu={e => e.preventDefault()}
    >
      <div className="absolute bottom-10 left-4 right-4 z-[10001] flex items-center justify-between gap-3 bg-black/45 backdrop-blur-md rounded-2xl px-5 py-4 shadow-xl border border-white/10">
        <span className="text-white/90 text-sm font-medium truncate">
          {charName} 正在查看你的手机…
        </span>
        <button
          onClick={() => onGrabBackRef.current(characterId)}
          className="shrink-0 bg-red-500/25 hover:bg-red-500/40 active:bg-red-500/60 border border-red-400/40 text-red-300 text-sm font-semibold rounded-xl px-5 py-2 transition-all active:scale-95"
        >
          抢回
        </button>
      </div>
    </div>
  );
}
