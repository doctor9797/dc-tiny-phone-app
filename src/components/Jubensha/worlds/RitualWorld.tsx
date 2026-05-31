import { motion } from 'motion/react';
import { LogOut, Sparkles } from 'lucide-react';
import type { WorldDetailProps } from './types';

export default function RitualWorld({ config, onStart, onExit }: WorldDetailProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-dvh bg-[#0f0c0a] text-[#d4af37] font-serif relative overflow-y-auto"
    >
      {/* celestial background glow */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_center,#1a1512_0%,#0a0806_100%)]" />
      <motion.div
        animate={{ scale: [1, 1.05, 1], opacity: [0.15, 0.25, 0.15] }}
        transition={{ duration: 6, repeat: Infinity }}
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#d4af37]/5 rounded-full blur-[120px] pointer-events-none"
      />

      {/* decorative border frame */}
      <div className="fixed inset-3 border border-[#8b6b23]/15 pointer-events-none" />
      <div className="fixed inset-[10px] border border-[#d4af37]/5 pointer-events-none" />

      {/* header - crown-like */}
      <div className="relative z-10 text-center pt-8 pb-4 border-b border-[#8b6b23]/20">
        <motion.div
          animate={{ rotate: [0, 3, 0, -3, 0] }}
          transition={{ duration: 8, repeat: Infinity }}
          className="inline-block"
        >
          <Sparkles size={20} className="text-[#d4af37]/60 mb-2 mx-auto" />
        </motion.div>
        <div className="text-[9px] tracking-[0.4em] text-[#8b6b23] uppercase mb-2">—— 圣 · 典 · 纪 ——</div>
        <h1 className="text-xl font-bold text-[#d4af37] tracking-wider">{config.background}</h1>
        <div className="text-xs text-[#8b6b23]/80 mt-1 tracking-widest">主题 · {config.theme}</div>
        <button onClick={onExit} className="absolute right-6 top-8 text-[#8b6b23]/50 hover:text-[#d4af37] transition-colors">
          <LogOut size={16} />
        </button>
      </div>

      {/* center seal / prophecy */}
      <div className="relative z-10 flex flex-col items-center py-8 px-6">
        {/* magic circle */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
          className="w-24 h-24 rounded-full border border-[#d4af37]/20 mb-6 flex items-center justify-center"
        >
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
            className="w-16 h-16 rounded-full border border-[#d4af37]/30 flex items-center justify-center"
          >
            <div className="w-8 h-8 rounded-full bg-[#d4af37]/10 border border-[#d4af37]/40 flex items-center justify-center">
              <span className="text-[#d4af37] text-xs">✦</span>
            </div>
          </motion.div>
        </motion.div>

        {/* prophecy text */}
        <div className="max-w-lg text-center mb-8">
          <div className="text-[10px] tracking-[0.3em] text-[#8b6b23] mb-3 uppercase">—— 预 言 ——</div>
          <p className="text-sm text-[#e5c76b]/80 leading-loose">
            在<span className="text-[#d4af37] font-bold">{config.background}</span>的古老殿堂中，<span className="text-[#d4af37] font-bold">{config.theme}</span>的帷幕正缓缓拉开。
            星辰排列成命运的字句，等待被命运选中的人们。
          </p>
        </div>

        {/* council cards - floating card layout around center */}
        <div className="w-full max-w-lg">
          <div className="text-[10px] tracking-[0.3em] text-[#8b6b23] text-center mb-4 uppercase">—— 命 运 之 席 ——</div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { name: '贤者', desc: '睿智的指引者' },
              { name: '隐士', desc: '沉默的守望者' },
              { name: '战士', desc: '不屈的守护者' },
              { name: '先知', desc: '洞悉命运者' },
            ].map((role, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.15 }}
                whileHover={{ scale: 1.03, transition: { duration: 0.2 } }}
                className="bg-[#14100e] border border-[#8b6b23]/20 p-4 cursor-pointer group
                  shadow-[0_0_20px_rgba(139,107,35,0.05)] hover:shadow-[0_0_30px_rgba(139,107,35,0.15)]
                  hover:border-[#d4af37]/40 transition-all"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-full border border-[#d4af37]/30 flex items-center justify-center">
                    <span className="text-[#d4af37] text-xs">{['✦', '◈', '♛', '◇'][i]}</span>
                  </div>
                  <div>
                    <div className="text-sm font-bold text-[#d4af37]">{role.name}</div>
                    <div className="text-[9px] text-[#8b6b23]/70 uppercase tracking-wider">{role.desc}</div>
                  </div>
                </div>
                <div className="text-[10px] text-[#8b6b23]/50 group-hover:text-[#d4af37]/70 transition-colors">
                  点击以缔结契约...
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* pledge button */}
        <div className="mt-8 mb-6 text-center">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onStart}
            className="px-10 py-3 bg-[#8b6b23]/10 border border-[#d4af37] text-[#d4af37] text-sm
              tracking-[0.3em] uppercase shadow-[0_0_20px_rgba(212,175,55,0.1)]
              hover:shadow-[0_0_40px_rgba(212,175,55,0.25)] hover:bg-[#d4af37]/10 transition-all"
          >
            缔结契约 · 开始
          </motion.button>
          <div className="text-[8px] text-[#8b6b23]/40 mt-3 tracking-widest">
            — 契约一经缔结，不可逆转 —
          </div>
        </div>
      </div>
    </motion.div>
  );
}
