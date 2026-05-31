import { motion } from 'motion/react';
import { Terminal, LogOut, ChevronRight, Cpu } from 'lucide-react';
import type { ThemeProps } from './types';

export default function CyberpunkTheme({ config, onStart, onExit }: ThemeProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 1.1 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
      className="min-h-screen bg-[#050510] text-[#0ff] font-mono relative overflow-hidden"
    >
      {/* Glitch Grid BG */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-fuchsia-900/20 blur-[150px] mix-blend-screen pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-cyan-900/20 blur-[120px] mix-blend-screen pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 border-b border-[#0ff]/30 bg-black/50 backdrop-blur-md p-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Cpu className="w-8 h-8 text-fuchsia-500" />
          <div>
            <div className="text-[10px] text-fuchsia-400 uppercase tracking-[0.2em]">System Status: Online</div>
            <h1 className="text-xl font-bold tracking-widest uppercase shadow-[#0ff] drop-shadow-[0_0_8px_rgba(0,255,255,0.8)]">
              {config.background} <span className="opacity-50 mx-2">/</span> {config.theme}
            </h1>
          </div>
        </div>
        <button onClick={onExit} className="text-[#0ff]/70 hover:text-[#0ff] hover:bg-[#0ff]/10 p-2 rounded transition-colors flex items-center gap-2 border border-transparent hover:border-[#0ff]/50">
          <LogOut className="w-5 h-5" />
          <span className="uppercase text-xs tracking-widest">Disconnect</span>
        </button>
      </header>

      {/* Content */}
      <main className="relative z-10 p-8 max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-8">
          <div className="p-6 border border-[#0ff]/20 bg-black/60 relative group">
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[#0ff]" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[#0ff]" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[#0ff]" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[#0ff]" />

            <h2 className="text-2xl font-bold mb-4 uppercase flex items-center group-hover:text-fuchsia-400 transition-colors">
              <Terminal className="mr-3 w-6 h-6" /> DATA_LOG // 剧本简介
            </h2>
            <p className="text-[#0ff]/70 leading-relaxed text-sm">
              在霓虹闪烁的钢铁丛林中，暗流涌动。财阀的AI终端被植入了未知的乱码，高级拾荒者在下水道发现了不属于这个世纪的义体残骸。
              当所有数据都指向那个被称为"深渊之眼"的服务器时，你们被卷入了一场无法下线的致命游戏...
            </p>
          </div>

          <div>
            <h3 className="text-lg uppercase tracking-widest text-fuchsia-400 mb-4 flex items-center">
              <ChevronRight className="w-5 h-5 mr-1" /> Available Avatars
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map(id => (
                <div key={id} className="border border-fuchsia-500/30 bg-fuchsia-950/10 hover:bg-fuchsia-500/20 p-4 cursor-pointer transition-all hover:-translate-y-1 relative">
                  <div className="text-[10px] text-fuchsia-300 absolute top-2 right-2">ID_00{id}</div>
                  <div className="w-12 h-12 bg-white/5 mb-3 border border-white/10 flex items-center justify-center text-xl font-bold opacity-50">?</div>
                  <h4 className="font-bold">边缘黑客 / Hacker</h4>
                  <div className="text-xs text-[#0ff]/50 mt-1 uppercase">Difficulty: Hard</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="border border-[#0ff]/20 p-4 bg-[#0ff]/5">
            <div className="text-xs uppercase text-[#0ff]/50 mb-2">Neural Link Integrity</div>
            <div className="w-full h-2 bg-black overflow-hidden border border-[#0ff]/30">
              <motion.div
                initial={{ width: '0%' }}
                animate={{ width: '78%' }}
                transition={{ duration: 2, delay: 0.5 }}
                className="h-full bg-fuchsia-500 shadow-[0_0_10px_#d946ef]"
              />
            </div>
            <div className="text-right text-xs mt-1 text-fuchsia-400 tracking-widest">78.00%</div>
          </div>

          <button onClick={onStart} className="w-full py-4 border border-[#0ff] text-[#0ff] uppercase tracking-[0.3em] hover:bg-[#0ff] hover:text-black transition-all shadow-[0_0_15px_rgba(0,255,255,0.2)] hover:shadow-[0_0_30px_rgba(0,255,255,0.6)] font-bold">
            Initialize Sequence
          </button>
        </div>
      </main>
    </motion.div>
  );
}
