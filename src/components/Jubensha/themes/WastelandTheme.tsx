import { motion } from 'motion/react';
import { LogOut, AlertTriangle, Radio } from 'lucide-react';
import type { ThemeProps } from './types';

export default function WastelandTheme({ config, onStart, onExit }: ThemeProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen bg-[#1c1b18] text-[#a39a88] font-mono relative overflow-hidden"
    >
      {/* Dirt/Grunge texture (simulated with CSS gradients) */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(65,55,35,0.4)_0%,transparent_70%)] pointer-events-none" />
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'4\' height=\'4\' viewBox=\'0 0 4 4\'%3E%3Crect width=\'4\' height=\'4\' fill=\'%23000\'/%3E%3Crect width=\'1\' height=\'1\' fill=\'%23fff\'/%3E%3C/svg%3E")' }} />

      {/* Header */}
      <header className="relative z-10 p-4 border-b-4 border-[#332f26] bg-[#161513] flex justify-between items-center px-8">
        <div className="flex items-center gap-4">
          <AlertTriangle className="w-8 h-8 text-[#e07a3e]" />
          <div className="uppercase tracking-widest">
             <div className="text-[10px] text-[#e07a3e] font-bold">SIGNAL ESTABLISHED</div>
             <h1 className="text-xl font-black text-[#d6cdba]">
               {config.background} <span className="opacity-30">|</span> {config.theme}
             </h1>
          </div>
        </div>
        <button onClick={onExit} className="text-[#a39a88] hover:text-[#e07a3e] p-2 flex items-center gap-2 group">
          <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span className="uppercase font-bold tracking-widest text-sm">Abort</span>
        </button>
      </header>

      {/* Content */}
      <main className="relative z-10 p-8 max-w-5xl mx-auto mt-8 grid grid-cols-1 md:grid-cols-4 gap-8">

        {/* Left Nav Menu */}
        <div className="md:col-span-1 space-y-4 font-bold uppercase tracking-widest">
           {['Mission Brief', 'Personnel Roster', 'Map Data', 'Inventory'].map((item, idx) => (
             <div key={idx} className={`p-4 border-l-4 cursor-pointer transition-colors ${idx === 0 ? 'border-[#e07a3e] bg-[#332f26] text-[#d6cdba]' : 'border-[#332f26] bg-[#1c1b18] hover:bg-[#25221d]'}`}>
               {item}
             </div>
           ))}
        </div>

        {/* Main Content Area */}
        <div className="md:col-span-3 bg-[#25221d] border-2 border-[#332f26] p-8 relative">
           {/* Tape visual effect */}
           <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-32 h-6 bg-[#d6cdba] opacity-20 rotate-2 pointer-events-none" />

           <div className="flex items-center gap-3 mb-6 border-b border-[#332f26] pb-4">
             <Radio className="text-[#e07a3e] animate-pulse" />
             <h2 className="text-2xl font-black text-[#d6cdba] uppercase tracking-wider">Broadcast Recording #402</h2>
           </div>

           <p className="text-lg text-[#b8b0a1] leading-relaxed mb-12">
             水资源已经断绝了十六天。庇护所的气闸舱门在昨晚被强制覆写了开启指令。
             我们在空气过滤器的滤芯里发现了高纯度的辐射尘埃，这意味着有人想毒死我们所有人。
             搜查每个人的储物柜，凶手就在我们这群苟延残喘的幸存者之中。
           </p>

           <div className="grid grid-cols-2 gap-4">
              {[
                { name: 'Drifter', tag: 'Unknown Origin' },
                { name: 'Mechanic', tag: 'Suspect A' }
              ].map((ch, idx) => (
                <div key={idx} className="border border-[#443e33] p-4 flex justify-between items-end hover:bg-[#332f26] cursor-pointer">
                  <div>
                     <div className="text-xs text-[#e07a3e] mb-1 uppercase font-bold">{ch.tag}</div>
                     <div className="text-xl font-black text-[#d6cdba] uppercase">{ch.name}</div>
                  </div>
                  <div className="text-4xl text-[#332f26] font-black">0{idx+1}</div>
                </div>
              ))}
           </div>

           <button onClick={onStart} className="w-full mt-12 bg-[#e07a3e] hover:bg-[#f6894b] text-[#1c1b18] py-4 font-black uppercase tracking-widest text-xl transition-colors">
             Confirm Selection
           </button>
        </div>

      </main>
    </motion.div>
  );
}
