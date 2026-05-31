import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface Props {
  wallpaper: string;
  onUnlock: () => void;
  onClose: () => void;
}

const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
const MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

export default function LockScreen({ wallpaper, onUnlock, onClose }: Props) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const wallpaperUrl = wallpaper && !wallpaper.startsWith('#')
    ? wallpaper.replace(/^url\(['"]?|['"]?\)$/g, '')
    : null;

  // Full inline style to avoid Tailwind JIT issues with dynamic classes
  const bgStyle = wallpaperUrl
    ? { backgroundImage: 'url(' + wallpaperUrl + ')', backgroundSize: 'cover' as const, backgroundPosition: 'center' as const, backgroundRepeat: 'no-repeat' as const }
    : wallpaper?.startsWith('#')
    ? { backgroundColor: wallpaper }
    : { backgroundColor: '#1a1a2e' };

  const timeStr = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
  const dayName = WEEKDAYS[now.getDay()];
  const monthStr = now.getFullYear() + '年' + MONTHS[now.getMonth()] + now.getDate() + '日';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 flex flex-col justify-between pt-16 pb-8 px-6 select-none"
      style={bgStyle}
    >
      <div className="flex flex-col items-center flex-1 space-y-2 mt-16 text-white drop-shadow-lg">
        <p className="text-lg font-medium tracking-wide opacity-80">{dayName}</p>
        <h1 className="text-[80px] font-semibold leading-none tracking-tight">{timeStr}</h1>
        <p className="text-base opacity-70">{monthStr}</p>
      </div>

      <motion.div
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.2}
        onDragEnd={(_, info) => {
          if (info.offset.y < -50) onUnlock();
        }}
        className="w-full flex flex-col items-center space-y-2 cursor-grab active:cursor-grabbing text-white drop-shadow-md z-10 pb-4"
      >
        <span className="text-sm font-medium tracking-wide animate-pulse">上滑解锁</span>
        <div className="w-32 h-1 bg-white/60 rounded-full" />
      </motion.div>
    </motion.div>
  );
}
