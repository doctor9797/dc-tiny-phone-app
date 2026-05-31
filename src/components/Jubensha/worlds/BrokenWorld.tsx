import { motion } from 'motion/react';
import { LogOut } from 'lucide-react';
import type { WorldDetailProps } from './types';

function NoiseOverlay() {
  return (
    <motion.div
      className="fixed inset-0 pointer-events-none opacity-[0.04]"
      animate={{ opacity: [0.03, 0.07, 0.03] }}
      transition={{ duration: 3, repeat: Infinity }}
      style={{
        backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")',
        backgroundSize: '128px 128px',
      }}
    />
  );
}

export default function BrokenWorld({ config, onStart, onExit }: WorldDetailProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-dvh bg-[#0a0908] text-[#7a7a7a] relative overflow-y-auto"
    >
      {/* vignette */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(0,0,0,0.9)_100%)]" />
      <NoiseOverlay />
      <motion.div
        animate={{ opacity: [0.08, 0.2, 0.08] }}
        transition={{ duration: 5, repeat: Infinity }}
        className="fixed top-1/3 left-1/2 -translate-x-1/2 w-72 h-72 bg-red-900/10 rounded-full blur-[100px] pointer-events-none"
      />

      {/* flickering scanline bar */}
      <motion.div
        animate={{ top: ['0%', '100%'] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
        className="fixed left-0 right-0 h-px bg-red-900/40 pointer-events-none"
      />

      {/* header - broken/corrupted */}
      <div className="relative z-10 px-4 pt-6 pb-4 border-b border-[#1a1a1a]" style={{ transform: 'rotate(-0.3deg)' }}>
        <div className="flex items-start justify-between">
          <div>
            <motion.div
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 2.5, repeat: Infinity }}
              className="text-[9px] text-red-900/60 tracking-[0.3em] uppercase mb-2 flex items-center gap-2"
            >
              <span className="w-1.5 h-1.5 bg-red-800 rounded-full inline-block" />
              SIGNAL_DEGRADED
              <span className="w-1.5 h-1.5 bg-red-800 rounded-full inline-block" />
            </motion.div>
            <h1 className="text-xl font-black text-[#3a3a3a] tracking-wide">{config.background}</h1>
            <div className="text-xs text-[#555] mt-1 tracking-wider">THEME CORRUPTED: {config.theme}</div>
          </div>
          <button onClick={onExit} className="text-[#555] hover:text-red-900 transition-colors p-2 border border-[#2a2a2a]">
            <LogOut size={16} />
          </button>
        </div>
      </div>

      {/* main - fragmented */}
      <div className="relative z-10 p-4 max-w-3xl mx-auto space-y-4">
        {/* fragmented plot */}
        <div className="border border-[#2a2a2a] bg-black/60" style={{ transform: 'rotate(0.4deg)' }}>
          <div className="px-3 py-2 border-b border-[#2a2a2a] bg-[#0a0908]">
            <span className="text-[9px] text-red-900/60 uppercase tracking-widest">// RECOVERED_DATA //</span>
          </div>
          <div className="p-4">
            <div className="text-xs text-[#6a6a6a] leading-relaxed space-y-2">
              <motion.p
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 4, repeat: Infinity }}
                style={{ transform: 'skewX(-1deg)' }}
              >
                [RECOVERED]: 在<span className="text-[#8a8a8a]">{config.background}</span>的废墟深处，一段被刻意抹除的记录正在自愈。
                核心协议标记为 <span className="text-red-900/80">[ {config.theme} ]</span>。
              </motion.p>
              <p className="text-[#555] text-[11px] border-l border-red-900/30 pl-3"
                style={{ transform: 'skewX(1deg)' }}>
                ⚠ 数据完整性: 43% · 建议立即提取
              </p>
            </div>
          </div>
        </div>

        {/* fragmented survivors list */}
        <div className="border border-[#2a2a2a] bg-black/60" style={{ transform: 'rotate(-0.3deg)' }}>
          <div className="px-3 py-2 border-b border-[#2a2a2a] bg-[#0a0908] flex items-center justify-between">
            <span className="text-[9px] text-red-900/60 uppercase tracking-widest">// SURVIVOR_LOG //</span>
            <motion.span
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="text-[8px] text-red-900/40"
            >RECORDING...</motion.span>
          </div>
          <div className="p-3 grid grid-cols-2 gap-2">
            {[1, 2, 3, 4].map(id => {
              const rotations = ['0.8deg', '-0.7deg', '1.2deg', '-0.4deg'];
              const margins = ['0', '12px', '-4px', '8px'];
              return (
                <div key={id}
                  className="border border-[#2a2a2a] bg-[#0a0908] p-3 hover:border-red-900/40 transition-colors cursor-pointer group"
                  style={{ transform: `rotate(${rotations[id - 1]})`, marginTop: margins[id - 1] }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <motion.div
                      animate={{ opacity: [0.8, 0.3, 0.8] }}
                      transition={{ duration: 2, delay: id * 0.3, repeat: Infinity }}
                      className="w-1.5 h-1.5 rounded-full bg-red-900"
                    />
                    <span className="text-[8px] text-red-900/60">ID: UNKNOWN_{String(id).padStart(2, '0')}</span>
                  </div>
                  <div className="text-sm font-bold text-[#5a5a5a]">
                    {['流浪者', '机械师', '拾荒者', '医生'][id - 1]}
                  </div>
                  <div className="text-[9px] text-[#555] mt-1">STATUS: <span className="text-red-900/60">COMPROMISED</span></div>
                </div>
              );
            })}
          </div>
        </div>

        {/* signal monitor */}
        <div className="border border-[#2a2a2a] bg-black/60" style={{ transform: 'rotate(0.2deg)' }}>
          <div className="px-3 py-2 border-b border-[#2a2a2a] bg-[#0a0908]">
            <span className="text-[9px] text-red-900/60 uppercase tracking-widest">// SIGNAL_MONITOR //</span>
          </div>
          <div className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex-1 h-2 bg-[#1a1a1a] overflow-hidden">
                <motion.div
                  initial={{ width: '0%' }}
                  animate={{ width: '47%' }}
                  transition={{ duration: 2, delay: 0.5 }}
                  className="h-full bg-red-900/60"
                />
              </div>
              <span className="text-[10px] text-red-900/60 w-10 text-right">47%</span>
            </div>
            <div className="text-[8px] text-[#555] uppercase tracking-widest text-center">Signal stability critical</div>
          </div>
        </div>

        {/* start button - distressed */}
        <div className="pt-2" style={{ transform: 'rotate(-0.5deg)' }}>
          <button onClick={onStart}
            className="w-full py-4 border border-red-900/40 text-red-900/80 uppercase tracking-[0.3em] text-sm font-bold
              hover:bg-red-900/20 hover:text-red-400 transition-all duration-300 bg-transparent"
          >
            [ FORCE_INITIALIZE ]
          </button>
          <div className="text-[7px] text-[#3a3a3a] text-center mt-2 tracking-widest">
            WARNING: data loss may occur
          </div>
        </div>
      </div>
    </motion.div>
  );
}
