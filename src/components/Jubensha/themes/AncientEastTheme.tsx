import { motion } from 'motion/react';
import { LogOut } from 'lucide-react';
import type { ThemeProps } from './types';

export default function AncientEastTheme({ config, onStart, onExit }: ThemeProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, filter: 'blur(10px)' }}
      transition={{ duration: 1.5 }}
      className="min-h-screen bg-[#f4ecd8] text-[#2c2826] font-serif relative overflow-hidden flex flex-col md:flex-row"
    >
      {/* Ink Splash/Paper Textures */}
      <div className="absolute inset-0 opacity-[0.4] mix-blend-multiply pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.1)_100%)]" />
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-[#8a1c1c] rounded-full blur-[100px] opacity-20 pointer-events-none" />

      {/* Decorative Border */}
      <div className="absolute inset-4 border border-[#8a1c1c]/20 pointer-events-none" />
      <div className="absolute inset-[1.25rem] border border-[#2c2826]/10 pointer-events-none" />

      {/* Left/Top Navigation Header */}
      <header className="relative z-10 p-8 flex md:flex-col justify-between items-start border-b md:border-b-0 md:border-r border-[#2c2826]/10 md:h-screen w-full md:w-32 bg-[#f4ecd8]/50 backdrop-blur-sm">
        <div className="[writing-mode:horizontal-tb] md:[writing-mode:vertical-rl] space-y-4 md:space-y-0 md:-space-x-4 flex items-center md:items-start text-center md:text-left">
          <h1 className="text-3xl font-bold tracking-[0.2em] text-[#8a1c1c] drop-shadow-sm">
            {config.background}
          </h1>
          <span className="opacity-50 mx-4 md:my-4 md:mx-0">·</span>
          <h2 className="text-xl tracking-[0.3em]">
            {config.theme}
          </h2>
        </div>

        <button onClick={onExit} className="text-[#2c2826]/60 hover:text-[#8a1c1c] p-2 transition-colors flex flex-row md:flex-col items-center gap-2">
          <LogOut className="w-5 h-5 md:rotate-90" />
          <span className="text-sm tracking-widest [writing-mode:horizontal-tb] md:[writing-mode:vertical-rl]">归去</span>
        </button>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 p-8 md:p-16 max-w-5xl mx-auto overflow-y-auto w-full md:pr-32 flex flex-col md:flex-row gap-12 justify-center items-start">

        {/* Right side in visual layout (Actually left in DOM to stack cleanly on mobile) */}
        <div className="w-full md:w-2/3 space-y-12 shrink-0">
          <div className="relative">
            <h3 className="text-4xl text-[#8a1c1c] mb-6 inline-block relative font-bold">
              <span className="relative z-10">卷轴 · 序章</span>
              <span className="absolute bottom-1 left-0 w-full h-[1px] bg-[#8a1c1c]/30"></span>
            </h3>
            <p className="text-lg leading-loose tracking-wider text-justify first-letter:text-3xl first-letter:text-[#8a1c1c]">
              建安十三年，冬。江东大雾连绵不绝，铜雀台上的歌女一夜之间皆成白骨。
              坊间传闻，有妖星现于东南界，隐隐有龙吟之声。
              各位侠客、方士被一纸神秘的"赤壁令"召集于这迷雾深处的孤舟之上。
              煮酒论英雄，谁知杯中物，是酒，还是血？
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mt-12">
            {[
              { role: '白衣剑客', desc: '一剑霜寒十四州' },
              { role: '神秘方士', desc: '袖藏乾坤算天机' },
              { role: '江东名伶', desc: '曲尽人散泪空流' },
              { role: '远游商贾', desc: '富可敌国命如纸' }
            ].map((ch, idx) => (
              <div key={idx} className="group relative border border-[#2c2826]/10 p-6 hover:bg-[#8a1c1c]/5 transition-colors cursor-pointer ring-1 ring-transparent hover:ring-[#8a1c1c]/30">
                <div className="absolute top-0 right-0 w-8 h-8 flex items-center justify-center text-2xl text-[#2c2826]/10 group-hover:text-[#8a1c1c]/20 transition-colors">
                  {['甲', '乙', '丙', '丁'][idx]}
                </div>
                <h4 className="text-xl font-bold tracking-widest text-[#2c2826] mb-2">{ch.role}</h4>
                <p className="text-[#2c2826]/60 text-sm tracking-widest">{ch.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Call to action (Vertical layout on desktop) */}
        <div className="w-full md:w-auto flex flex-row md:flex-col items-center justify-center gap-8 pl-0 md:pl-12 md:border-l border-[#2c2826]/10 pt-7 md:pt-0">
           <div className="w-16 h-16 rounded-full border border-[#8a1c1c] flex items-center justify-center text-[#8a1c1c] text-3xl shrink-0">
             印
           </div>

           <button onClick={onStart} className="[writing-mode:horizontal-tb] md:[writing-mode:vertical-rl] px-8 py-4 md:px-4 md:py-12 border border-[#2c2826] text-[#2c2826] hover:bg-[#8a1c1c] hover:text-[#f4ecd8] hover:border-[#8a1c1c] transition-all tracking-[0.5em] text-lg font-bold shrink-0">
             揭开序幕
           </button>
        </div>

      </main>
    </motion.div>
  );
}
