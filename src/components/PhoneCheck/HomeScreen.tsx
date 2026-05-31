import { type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, Phone, Camera, Image as ImageIcon, Music, Settings, Calendar } from 'lucide-react';

interface AppIconProps {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  bg: string;
}

function AppIcon({ icon, label, onClick, bg }: AppIconProps) {
  return (
    <div className="flex flex-col items-center space-y-1.5">
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={onClick}
        className={'w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-sm ' + bg}
      >
        {icon}
      </motion.button>
      <span className="text-white text-[11px] font-medium drop-shadow-md">{label}</span>
    </div>
  );
}

interface Props {
  wallpaper: string;
  onOpenApp: (app: string) => void;
}

export default function HomeScreen({ wallpaper, onOpenApp }: Props) {
  const wallpaperUrl = wallpaper && !wallpaper.startsWith('#')
    ? wallpaper.replace(/^url\(['"]?|['"]?\)$/g, '')
    : null;

  const bgStyle = wallpaperUrl
    ? { backgroundImage: 'url(' + wallpaperUrl + ')', backgroundSize: 'cover' as const, backgroundPosition: 'center' as const }
    : wallpaper?.startsWith('#')
    ? { backgroundColor: wallpaper }
    : { backgroundColor: '#1a1a2e' };

  return (
    <motion.div
      initial={{ scale: 1.1, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      className="absolute inset-0"
      style={bgStyle}
    >
      <div className="absolute inset-0 bg-black/10" />

      <div className="relative h-full pt-20 px-6">
        <div className="grid grid-cols-4 gap-x-4 gap-y-7">
          <AppIcon icon={<MessageCircle size={28} fill="currentColor" />} label="微信" bg="bg-[#1AAD19]" onClick={() => onOpenApp('wechat')} />
          <AppIcon icon={<Phone size={28} />} label="电话" bg="bg-[#34C759]" onClick={() => onOpenApp('phone')} />
          <AppIcon icon={<Camera size={28} />} label="相机" bg="bg-[#FF3B30]" onClick={() => onOpenApp('camera')} />
          <AppIcon icon={<ImageIcon size={28} />} label="相册" bg="bg-gradient-to-br from-red-400 via-pink-400 to-purple-400" onClick={() => onOpenApp('photos')} />
          <AppIcon icon={<Music size={28} />} label="音乐" bg="bg-gradient-to-br from-red-500 to-red-600" onClick={() => onOpenApp('music')} />
          <AppIcon icon={<Settings size={28} />} label="设置" bg="bg-zinc-600" onClick={() => onOpenApp('settings')} />
          <AppIcon icon={<Calendar size={28} />} label="日历" bg="bg-[#007AFF]" onClick={() => onOpenApp('calendar')} />
        </div>
      </div>
    </motion.div>
  );
}
