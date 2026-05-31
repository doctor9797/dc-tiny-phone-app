import { motion } from 'motion/react';
import { Terminal, LogOut, Cpu, Wifi, Activity } from 'lucide-react';
import type { WorldDetailProps } from './types';

export default function CyberHUDWorld({ config, onStart, onExit }: WorldDetailProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-dvh bg-[#050510] text-[#0ff] font-mono relative overflow-y-auto"
    >
      {/* grid scanlines */}
      <div className="fixed inset-0 bg-[linear-gradient(rgba(0,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,255,0.03)_1px,transparent_1px)] bg-[size:30px_30px] pointer-events-none" />
      <div className="fixed inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.5)_50%)] bg-[size:100%_4px] pointer-events-none opacity-30" />
      {/* ambient glow */}
      <div className="fixed top-0 right-0 w-[600px] h-[600px] bg-fuchsia-900/20 blur-[120px] mix-blend-screen pointer-events-none" />
      <div className="fixed bottom-0 left-0 w-[500px] h-[500px] bg-cyan-900/15 blur-[100px] mix-blend-screen pointer-events-none" />

      {/* HUD Header */}
      <div className="relative z-10 border-b border-[#0ff]/20 bg-black/80 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-2 text-[8px] text-[#0ff]/50 border-b border-[#0ff]/10">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1"><Wifi size={10} className="text-fuchsia-400" /> LINK: SECURE</span>
            <span className="flex items-center gap-1"><Activity size={10} className="text-fuchsia-400" /> SYS: ONLINE</span>
          </div>
          <span className="text-fuchsia-400">NODE: DC-TINY-PHONE</span>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Cpu className="w-6 h-6 text-fuchsia-500" />
            <div>
              <div className="text-[10px] text-fuchsia-400 uppercase tracking-widest">MISSION DATA</div>
              <h1 className="text-lg font-bold tracking-wider text-[#0ff]">{config.background}</h1>
            </div>
          </div>
          <button onClick={onExit} className="text-[#0ff]/50 hover:text-[#0ff] p-2 border border-transparent hover:border-[#0ff]/30 transition-colors">
            <LogOut size={16} />
          </button>
        </div>
      </div>

      {/* Dashboard grid */}
      <div className="relative z-10 p-4 grid grid-cols-2 gap-3 max-w-3xl mx-auto">
        {/* Main plot panel */}
        <div className="col-span-2 border border-[#0ff]/20 bg-black/60">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-[#0ff]/10 bg-[#0ff]/5">
            <Terminal size={12} className="text-fuchsia-400" />
            <span className="text-[10px] uppercase tracking-widest text-fuchsia-400">PLOT_DATA.exe</span>
            <span className="ml-auto text-[8px] text-[#0ff]/40">v2.4.1</span>
          </div>
          <div className="p-3 text-xs text-[#0ff]/70 leading-relaxed">
            <p className="mb-2">
              <span className="text-fuchsia-300">SYSTEM_LOG:</span> 检测到未知数据流侵入核心网络。
              <span className="text-[#0ff]">{config.background}</span> 防火墙已在 <span className="text-[#0ff]">0x{Date.now().toString(16)}</span> 端口检测到异常流量。
            </p>
            <p className="text-[#0ff]/50">
              协议 <span className="text-fuchsia-400">[{config.theme}]</span> 已激活。所有节点等待接入。
            </p>
          </div>
        </div>

        {/* Avatar nodes */}
        <div className="col-span-2 border border-[#0ff]/20 bg-black/60">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-[#0ff]/10">
            <span className="text-[10px] uppercase tracking-widest text-fuchsia-400">AGENT_NODES</span>
            <span className="text-[8px] text-[#0ff]/40 ml-auto">4 ONLINE</span>
          </div>
          <div className="p-3 grid grid-cols-2 gap-2">
            {[1, 2, 3, 4].map(id => (
              <div key={id} className="border border-[#0ff]/10 bg-black/40 p-3 hover:border-fuchsia-500/40 transition-colors cursor-pointer group">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-6 h-6 border border-[#0ff]/20 flex items-center justify-center text-[10px] text-[#0ff]/60 bg-black">0{id}</div>
                  <span className="text-[8px] text-green-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full shadow-[0_0_4px_#4ade80]" />
                    ACTIVE
                  </span>
                </div>
                <div className="text-[11px] text-[#0ff] font-bold mb-0.5">AGENT-{String(id).padStart(2, '0')}</div>
                <div className="text-[9px] text-[#0ff]/40">STATUS: AWAITING_INPUT</div>
              </div>
            ))}
          </div>
        </div>

        {/* System status panel */}
        <div className="col-span-2 border border-[#0ff]/20 bg-black/60">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-[#0ff]/10">
            <span className="text-[10px] uppercase tracking-widest text-fuchsia-400">NEURAL LINK STATUS</span>
          </div>
          <div className="p-3 space-y-3">
            <div>
              <div className="flex justify-between text-[9px] text-[#0ff]/50 mb-1">
                <span>CONNECTION STABILITY</span>
                <span className="text-fuchsia-400">92%</span>
              </div>
              <div className="h-2 bg-black border border-[#0ff]/30 overflow-hidden">
                <motion.div
                  initial={{ width: '0%' }}
                  animate={{ width: '92%' }}
                  transition={{ duration: 1.5, delay: 0.3 }}
                  className="h-full bg-gradient-to-r from-fuchsia-500 to-cyan-400 shadow-[0_0_8px_rgba(0,255,255,0.5)]"
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[9px] text-[#0ff]/50 mb-1">
                <span>DATA INTEGRITY</span>
                <span className="text-fuchsia-400">78%</span>
              </div>
              <div className="h-2 bg-black border border-[#0ff]/30 overflow-hidden">
                <motion.div
                  initial={{ width: '0%' }}
                  animate={{ width: '78%' }}
                  transition={{ duration: 1.5, delay: 0.6 }}
                  className="h-full bg-gradient-to-r from-fuchsia-500 to-cyan-400 shadow-[0_0_8px_rgba(0,255,255,0.5)]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Initialize button */}
        <div className="col-span-2 p-4">
          <button onClick={onStart}
            className="w-full py-4 border border-[#0ff] text-[#0ff] uppercase tracking-[0.3em] text-sm font-bold
              hover:bg-[#0ff] hover:text-black transition-all
              shadow-[0_0_15px_rgba(0,255,255,0.15)] hover:shadow-[0_0_40px_rgba(0,255,255,0.4)]
              bg-transparent"
          >
            INITIALIZE_SEQUENCE
          </button>
        </div>
      </div>
    </motion.div>
  );
}
