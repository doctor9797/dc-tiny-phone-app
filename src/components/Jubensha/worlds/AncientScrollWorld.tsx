import { motion } from 'motion/react';
import { ScrollText, LogOut } from 'lucide-react';
import type { WorldDetailProps } from './types';

export default function AncientScrollWorld({ config, onStart, onExit }: WorldDetailProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-dvh bg-[#f4ecd8] text-[#2c2826] font-serif relative overflow-y-auto"
    >
      {/* parchment texture overlay */}
      <div className="fixed inset-0 opacity-20 pointer-events-none mix-blend-multiply"
        style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'100\' height=\'100\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence baseFrequency=\'0.05\' numOctaves=\'4\'/%3E%3C/filter%3E%3Crect width=\'100\' height=\'100\' filter=\'url(%23n)\' opacity=\'0.3\'/%3E%3C/svg%3E")', backgroundSize: '200px 200px' }}
      />

      {/* top seal stripe */}
      <div className="relative z-10 h-2 bg-[#8a1c1c]" />

      {/* header - minimal, like a scroll title */}
      <div className="relative z-10 px-6 pt-8 pb-4 flex items-start justify-between border-b border-[#2c2826]/10">
        <div>
          <div className="text-[10px] tracking-[0.3em] text-[#8a1c1c] mb-2">—— 卷 · 轴 · 纪 ——</div>
          <h1 className="text-2xl font-bold tracking-wider text-[#2c2826]">{config.background}</h1>
          <div className="text-sm text-[#8a8178] mt-1 tracking-wider">主题 · {config.theme}</div>
        </div>
        <button onClick={onExit} className="text-[#8a8178] hover:text-[#8a1c1c] transition-colors p-2">
          <LogOut size={18} />
        </button>
      </div>

      {/* main content - document style, like reading a scroll */}
      <div className="relative z-10 px-6 py-8 max-w-2xl mx-auto">
        {/* seal mark */}
        <div className="flex justify-center mb-8">
          <div className="w-14 h-14 rounded-full border-2 border-[#8a1c1c] flex items-center justify-center">
            <span className="text-[#8a1c1c] text-lg font-bold" style={{ writingMode: 'vertical-rl' as any, letterSpacing: '0.3em' }}>
              卷
            </span>
          </div>
        </div>

        {/* Document prose - no cards, just flowing text with ink decorations */}
        <div className="space-y-8">
          {/* chapter-like section */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px flex-1 bg-[#2c2826]/20" />
              <span className="text-[10px] tracking-[0.3em] text-[#8a1c1c]">序 · 章</span>
              <div className="h-px flex-1 bg-[#2c2826]/20" />
            </div>
            <div className="leading-loose text-sm text-[#2c2826]/80 text-justify indent-8">
              天地玄黄，宇宙洪荒。在<span className="text-[#8a1c1c] font-semibold">{config.background}</span>的宏大画卷中，一段关于<span className="text-[#8a1c1c] font-semibold">{config.theme}</span>的故事徐徐展开。
              墨迹未干，琴声未歇，暗流已在字里行间涌动。
            </div>
          </section>

          {/* vertical inscription */}
          <div className="flex justify-center py-4">
            <div className="flex gap-6">
              {['暗', '流', '如', '墨'].map(c => (
                <div key={c} className="text-lg text-[#8a1c1c] font-bold opacity-60"
                  style={{ writingMode: 'vertical-rl' as any, height: '60px' }}>
                  {c}
                </div>
              ))}
            </div>
          </div>

          {/* character list - presented as a "cast list" on a scroll */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px flex-1 bg-[#2c2826]/20" />
              <span className="text-[10px] tracking-[0.3em] text-[#8a1c1c]">人 · 物</span>
              <div className="h-px flex-1 bg-[#2c2826]/20" />
            </div>
            <div className="space-y-3">
              {[1, 2, 3, 4].map(id => (
                <div key={id} className="border-l-2 border-[#8a1c1c]/30 pl-4 py-2 hover:border-[#8a1c1c] transition-colors cursor-pointer group">
                  <div className="flex items-center gap-3">
                    <span className="text-[#8a1c1c] text-lg">{"甲乙丙丁"[id - 1]}</span>
                    <div>
                      <div className="font-bold text-[#2c2826] text-sm">无名氏 {id}</div>
                      <div className="text-xs text-[#8a8178]">身份未明 · 来历未知</div>
                    </div>
                    <span className="ml-auto text-[10px] text-[#8a8178] opacity-0 group-hover:opacity-100 transition-opacity">详 →</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ink wash decorative */}
          <div className="flex justify-center opacity-20">
            <div className="w-24 h-px bg-[#8a1c1c]" />
          </div>
        </div>
      </div>

      {/* bottom actions */}
      <div className="relative z-10 px-6 py-6 border-t border-[#2c2826]/10">
        <div className="max-w-2xl mx-auto flex justify-between items-center">
          <div className="text-[10px] text-[#8a8178] tracking-widest">—— 卷终可翻页 ——</div>
          <button onClick={onStart}
            className="px-8 py-3 bg-[#8a1c1c] text-[#f4ecd8] tracking-[0.2em] text-sm hover:bg-[#6a1414] transition-colors"
          >
            展卷
          </button>
        </div>
      </div>
    </motion.div>
  );
}
