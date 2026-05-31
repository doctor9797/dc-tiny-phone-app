import { motion } from 'motion/react';
import { LogOut, Eye, Moon } from 'lucide-react';
import type { ThemeProps } from './types';

export default function HorrorCthulhuTheme({ config, onStart, onExit }: ThemeProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 2 }}
      className="min-h-screen bg-[#070707] text-[#8e8e8e] font-sans relative overflow-hidden"
    >
      {/* Heavy Vignette & Noise */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.9)_80%)] z-20" />
      <div className="absolute inset-0 pointer-events-none opacity-20 z-10" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")' }} />

      {/* Creepy Red Glow */}
      <motion.div
        animate={{ opacity: [0.1, 0.3, 0.1], scale: [1, 1.05, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-red-900/20 rounded-full blur-[150px] pointer-events-none"
      />

      {/* Header */}
      <header className="relative z-30 p-6 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Moon className="w-6 h-6 text-red-800" />
          <h1 className="text-2xl tracking-[0.2em] text-[#d6d6d6] drop-shadow-[0_0_10px_rgba(255,0,0,0.3)]">
            {config.background} <span className="text-red-900/50 mx-2">|</span> <span className="text-red-800">{config.theme}</span>
          </h1>
        </div>
        <button onClick={onExit} className="text-[#8e8e8e] hover:text-red-600 p-2 transition-colors flex items-center gap-2 group">
          <LogOut className="w-5 h-5 group-hover:animate-pulse" />
          <span className="uppercase text-xs tracking-widest font-mono">Escape</span>
        </button>
      </header>

      {/* Content */}
      <main className="relative z-30 p-8 max-w-4xl mx-auto mt-12 flex flex-col items-center">

        <div className="text-center mb-16 relative">
          <Eye className="w-12 h-12 text-red-950 mx-auto mb-6 opacity-50" />
          <h2 className="text-xl md:text-3xl tracking-widest text-[#a8a8a8] mb-8 relative inline-block font-bold">
            <span className="relative z-10">《 羊皮卷上的无名之音 》</span>
          </h2>
          <p className="text-lg md:text-xl text-[#7a7a7a] leading-relaxed max-w-2xl mx-auto text-justify whitespace-pre-line tracking-wide font-serif">
            {'你听见了吗？\n墙壁里传来的，不是水管的滴答声。\n是海浪。\n\n那座被浓雾包裹的孤岛上，灯塔的光芒呈现出一种病态的绿。村长说，今晚是祭祀海神的日子。但你低头看了看自己的手...\n为什么，长出了鳞片？'}
          </p>
        </div>

        <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            { name: '失忆的外乡人', desc: '带着一本沾血的日记本醒来。' },
            { name: '老渔夫', desc: '沉默寡言，脸上有奇怪的鳃状疤痕。' },
            { name: '神婆', desc: '用未知语言吟唱着古老的咒语。' },
            { name: '灯塔看守人', desc: '从不见光，据说他和灯塔融为一体。' },
          ].map((ch, i) => (
            <div key={i} className="border border-[#1a1a1a] bg-black/40 p-6 relative group overflow-hidden cursor-pointer hover:border-red-900/50 transition-colors">
              <div className="absolute inset-0 bg-red-900/0 group-hover:bg-red-900/10 transition-colors" />
              <div className="relative z-10">
                <div className="text-red-900/50 text-4xl absolute -right-4 -top-4 opacity-30 select-none group-hover:scale-110 transition-transform font-bold">
                  死
                </div>
                <h3 className="text-[#c2c2c2] text-xl font-bold mb-2 font-serif">{ch.name}</h3>
                <p className="text-[#555] text-sm">{ch.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <button onClick={onStart} className="mt-20 px-12 py-4 bg-red-950/20 border border-red-900 text-red-500 hover:bg-red-900 hover:text-white transition-all font-bold tracking-[0.5em] text-2xl uppercase relative overflow-hidden group">
          <span className="relative z-10">睁开眼睛</span>
          <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(255,0,0,0.1)_10px,rgba(255,0,0,0.1)_20px)] opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>

      </main>
    </motion.div>
  );
}
