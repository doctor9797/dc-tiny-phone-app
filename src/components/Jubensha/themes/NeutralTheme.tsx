import { motion } from 'motion/react';
import { LogOut, BookOpen, Users } from 'lucide-react';
import type { ThemeProps } from './types';

export default function NeutralTheme({ config, onStart, onExit }: ThemeProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen bg-zinc-950 text-zinc-200 font-sans relative"
    >
      <header className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/50 backdrop-blur top-0 sticky z-10">
        <div className="flex items-center gap-3">
          <BookOpen className="w-5 h-5 text-zinc-400" />
          <h1 className="font-medium text-lg">
            <span className="text-zinc-500">{config.background}</span>
            <span className="mx-2 text-zinc-700">/</span>
            <span className="text-zinc-300">{config.theme}</span>
          </h1>
        </div>
        <button onClick={onExit} className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors bg-zinc-900 px-4 py-2 rounded-lg hover:bg-zinc-800 text-sm">
          <LogOut className="w-4 h-4" />
          <span>返回大厅</span>
        </button>
      </header>

      <main className="max-w-4xl mx-auto p-8 mt-8 space-y-12">
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-indigo-500" /> 剧本背景
          </h2>
          <div className="p-6 rounded-2xl bg-zinc-900 border border-zinc-800 leading-relaxed text-zinc-400 text-lg">
            这是一个发生在<span className="text-white">【{config.background}】</span>的原创故事。
            本剧本的核心机制是<span className="text-white">【{config.theme}】</span>。
            玩家需要在这个复杂的网络中寻找线索，解开隐藏在背后的真相。
            没有华丽的视觉滤镜，唯有硬核的逻辑与纯粹的剧情等待您的探索。
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold flex items-center gap-2">
              <Users className="w-6 h-6 text-indigo-500" /> 角色列表
            </h2>
            <span className="text-sm text-zinc-500">共 6 名角色可选</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(id => (
              <div key={id} className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800/80 transition-colors cursor-pointer group">
                <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center mb-4 group-hover:bg-indigo-500 transition-colors text-base font-bold">
                  {id}
                </div>
                <h3 className="font-medium text-lg text-white mb-1">未知角色 {id}</h3>
                <p className="text-sm text-zinc-500">点击查看详细人设与背景故事...</p>
              </div>
            ))}
          </div>
        </section>

        <div className="pt-8 border-t border-zinc-800 flex justify-end">
          <button onClick={onStart} className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-colors">
            确认并进入房间
          </button>
        </div>
      </main>
    </motion.div>
  );
}
