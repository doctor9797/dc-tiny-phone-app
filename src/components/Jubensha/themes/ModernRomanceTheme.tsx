import { motion } from 'motion/react';
import { LogOut, Heart, Sparkles } from 'lucide-react';
import type { ThemeProps } from './types';

export default function ModernRomanceTheme({ config, onStart, onExit }: ThemeProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.8 }}
      className="min-h-screen bg-[#fcfaf8] text-[#3c3836] font-sans relative overflow-hidden"
    >
      {/* Soft Pastel Gradients */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-rose-100/50 rounded-full blur-[100px] opacity-60 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-slate-200/50 rounded-full blur-[100px] opacity-60 pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 flex justify-between items-center p-6 lg:px-12">
        <div className="font-bold text-xl tracking-tight flex items-center gap-2 text-stone-700">
          {config.background} <span className="text-stone-300 mx-2">|</span> <span className="text-rose-400">{config.theme}</span>
        </div>
        <button onClick={onExit} className="text-stone-400 hover:text-stone-700 p-2 transition-colors flex items-center gap-2 rounded-full hover:bg-stone-100/50">
          <LogOut className="w-4 h-4" />
          <span className="text-sm font-medium">返回</span>
        </button>
      </header>

      {/* Content */}
      <main className="relative z-10 p-6 lg:p-12 max-w-6xl mx-auto flex flex-col md:flex-row gap-12 items-center min-h-[80vh]">

        {/* Left Side (Visual / Title) */}
        <div className="flex-1 w-full text-center md:text-left space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-stone-200/50 text-stone-600 text-sm font-medium mb-4">
            <Heart className="w-4 h-4" /> 剧情提要
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-stone-800 leading-tight">
             夏日最后的<br/>
             <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-slate-500">
               海风告白
             </span>
          </h1>
          <p className="text-lg text-stone-500 leading-relaxed max-w-lg mx-auto md:mx-0">
             在这个被阳光洒满的沿海小镇，你们六个人在高中毕业后的第七年重新相聚。
             曾经的秘密、未说出口的话语，都在这家名为「等待」的咖啡馆里悄然酝酿。
             是谁偷走了那封信？又是谁，在雨夜里哭泣？
          </p>

          <button onClick={onStart} className="mt-8 px-8 py-4 bg-stone-800 text-stone-100 rounded-full font-medium hover:scale-105 hover:shadow-xl transition-all shadow-[0_10px_40px_rgba(0,0,0,0.05)] flex items-center gap-2 mx-auto md:mx-0">
            <Sparkles className="w-5 h-5" /> 开始故事
          </button>
        </div>

        {/* Right Side (Character Cards in a grid) */}
        <div className="flex-1 w-full grid grid-cols-2 gap-4">
          {[
            { role: '林初夏', desc: '咖啡馆老板', color: 'bg-rose-100/50 text-rose-700' },
            { role: '陆星河', desc: '漂泊的摄影师', color: 'bg-slate-200/50 text-slate-700' },
            { role: '沈曼', desc: '精致的都市白领', color: 'bg-stone-200/50 text-stone-700' },
            { role: '顾言', desc: '寡言的医生', color: 'bg-teal-100/40 text-teal-700' }
          ].map((ch, idx) => (
            <div key={idx} className="bg-white/60 backdrop-blur-md border border-white/80 p-6 rounded-3xl shadow-sm hover:shadow-md transition-shadow cursor-pointer aspect-square flex flex-col justify-end relative overflow-hidden group">
               <div className={`absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-semibold ${ch.color}`}>
                 角色 {idx+1}
               </div>
               <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-white to-transparent opacity-80" />
               <div className="relative z-10">
                 <h3 className="text-2xl font-bold text-stone-800 mb-1">{ch.role}</h3>
                 <p className="text-sm border-l-2 border-stone-200 pl-2 text-stone-500">{ch.desc}</p>
               </div>
               <div className="absolute inset-0 border-2 border-transparent group-hover:border-stone-900/5 rounded-3xl transition-colors pointer-events-none" />
            </div>
          ))}
        </div>

      </main>
    </motion.div>
  );
}
