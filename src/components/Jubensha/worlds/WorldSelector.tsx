import { motion } from 'motion/react';
import type { WorldType, WorldOption } from './types';

const WORLDS: WorldOption[] = [
  {
    type: 'ancient-scroll',
    label: '卷轴纪',
    subtitle: '古代东方 · 民国 · 古希腊',
    description: '纵向阅读式文书，文字如卷轴铺展。无明显卡片边界，信息呈"文档"形态，而非界面。'
  },
  {
    type: 'cyber-hud',
    label: '数据寰',
    subtitle: '赛博朋克 · 星际 · 现代都市',
    description: '模块化HUD面板，数据块密集排布。科技框架与信息层级分明，呈现"驾驶舱"式交互。'
  },
  {
    type: 'broken',
    label: '废土纪',
    subtitle: '废土 · 克苏鲁 · 怪谈 · 恐怖',
    description: '不对称破损排版，边框撕裂。信息以碎片化方式呈现，像从坏掉的系统中抢救出的残片。'
  },
  {
    type: 'ritual',
    label: '圣典纪',
    subtitle: '魔法学院 · 奇幻',
    description: '中心放射式布局，卡片环绕悬浮。光晕边界与仪式感排版，如翻开一本厚重的魔法典籍。'
  }
];

interface PreviewBoxProps {
  world: WorldOption;
  index: number;
  onSelect: (type: WorldType) => void;
}

function AncientScrollPreview({ world, onSelect }: PreviewBoxProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => onSelect(world.type)}
      className="relative h-full bg-[#f4ecd8] text-[#2c2826] font-serif overflow-hidden cursor-pointer group flex flex-col"
    >
      {/* decorative borders */}
      <div className="absolute inset-2 border border-[#8a1c1c]/20 pointer-events-none" />
      <div className="absolute inset-[0.6rem] border border-[#2c2826]/10 pointer-events-none" />
      <div className="absolute -top-20 -right-20 w-40 h-40 bg-[#8a1c1c] rounded-full blur-[80px] opacity-10 pointer-events-none" />

      {/* Header Chip */}
      <div className="relative z-10 flex items-center gap-2 p-4 border-b border-[#2c2826]/10">
        <div className="w-6 h-6 rounded-full border border-[#8a1c1c]/40 flex items-center justify-center text-[10px] text-[#8a1c1c] shrink-0">卷</div>
        <div className="min-w-0">
          <div className="text-[11px] font-bold tracking-[0.2em] text-[#8a1c1c]">{world.label}</div>
          <div className="text-[8px] text-[#8a8178] tracking-widest truncate">{world.subtitle}</div>
        </div>
      </div>

      {/* Preview content */}
      <div className="relative z-10 flex-1 p-4 flex flex-col justify-center">
        <h3 className="text-3xl text-[#8a1c1c] font-bold mb-3 tracking-wider"
            style={{ writingMode: 'vertical-rl' as any, height: '60px', marginLeft: 'auto', marginRight: 'auto', lineHeight: '1.8' }}>
          卷轴
        </h3>
        <div className="space-y-2 text-justify">
          <div className="h-1.5 bg-[#2c2826]/20 rounded w-full" />
          <div className="h-1.5 bg-[#2c2826]/15 rounded w-5/6" />
          <div className="h-1.5 bg-[#2c2826]/10 rounded w-4/6" />
        </div>
        <div className="mt-3 flex justify-center gap-1">
          {['甲', '乙', '丙'].map(c => (
            <span key={c} className="text-[10px] px-2 py-0.5 border border-[#2c2826]/15 text-[#2c2826]/60">{c}</span>
          ))}
        </div>
        <div className="mt-3 mx-auto w-8 h-8 rounded-full border border-[#8a1c1c]/40 flex items-center justify-center text-xs text-[#8a1c1c]/60">印</div>
      </div>

      {/* Hover indicator */}
      <div className="absolute inset-0 bg-[#8a1c1c]/0 group-hover:bg-[#8a1c1c]/5 transition-colors pointer-events-none" />
    </motion.div>
  );
}

function CyberHUDPreview({ world, onSelect }: PreviewBoxProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => onSelect(world.type)}
      className="relative h-full bg-[#050510] text-[#0ff] font-mono overflow-hidden cursor-pointer group flex flex-col"
    >
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,255,0.05)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none" />
      <div className="absolute top-0 right-0 w-40 h-40 bg-fuchsia-900/20 blur-[80px] pointer-events-none" />

      <div className="relative z-10 flex items-center gap-2 p-3 border-b border-[#0ff]/20">
        <div className="w-2 h-2 rounded-full bg-fuchsia-500 shadow-[0_0_6px_#d946ef]" />
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-widest text-fuchsia-400 font-bold">{world.label}</div>
          <div className="text-[7px] text-[#0ff]/50 truncate">{world.subtitle}</div>
        </div>
        <div className="ml-auto text-[8px] text-[#0ff]/40">ONLINE</div>
      </div>

      <div className="relative z-10 flex-1 p-3 grid grid-cols-2 gap-2">
        <div className="border border-[#0ff]/15 bg-black/40 p-2 col-span-2">
          <div className="text-[8px] uppercase text-fuchsia-400 mb-1">DATA</div>
          <div className="space-y-1">
            <div className="h-1 bg-[#0ff]/20 w-full" />
            <div className="h-1 bg-[#0ff]/10 w-3/4" />
          </div>
        </div>
        <div className="border border-[#0ff]/15 bg-black/40 p-2">
          <div className="text-[8px] text-[#0ff]/50 mb-1">ID_01</div>
          <div className="w-6 h-6 bg-white/5 border border-white/10 flex items-center justify-center text-[8px] opacity-50">?</div>
        </div>
        <div className="border border-fuchsia-500/20 bg-fuchsia-950/10 p-2">
          <div className="text-[8px] text-fuchsia-300 mb-1">ID_02</div>
          <div className="w-6 h-6 bg-white/5 border border-white/10 flex items-center justify-center text-[8px] opacity-50">?</div>
        </div>
        <div className="col-span-2 border border-[#0ff]/15 p-2 bg-[#0ff]/5">
          <div className="text-[7px] text-[#0ff]/50 mb-1">NEURAL LINK</div>
          <div className="h-1.5 bg-black border border-[#0ff]/30 overflow-hidden">
            <div className="h-full w-[60%] bg-fuchsia-500 shadow-[0_0_6px_#d946ef]" />
          </div>
        </div>
        <div className="col-span-2 border border-[#0ff] text-[#0ff] text-center py-1.5 text-[9px] uppercase tracking-widest hover:bg-[#0ff] hover:text-black transition-all">
          INITIALIZE
        </div>
      </div>

      <div className="absolute inset-0 border-2 border-transparent group-hover:border-[#0ff]/20 transition-colors pointer-events-none" />
    </motion.div>
  );
}

function BrokenPreview({ world, onSelect }: PreviewBoxProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => onSelect(world.type)}
      className="relative h-full bg-[#0a0908] text-[#7a7a7a] overflow-hidden cursor-pointer group flex flex-col"
    >
      {/* Vignette */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.8)_100%)]" />
      <motion.div
        animate={{ opacity: [0.05, 0.12, 0.05] }}
        transition={{ duration: 4, repeat: Infinity }}
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.8\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")', backgroundSize: '100px 100px' }}
      />
      <motion.div animate={{ opacity: [0.1, 0.25, 0.1] }} transition={{ duration: 6, repeat: Infinity }} className="absolute top-1/4 left-1/2 -translate-x-1/2 w-40 h-40 bg-red-900/20 rounded-full blur-[80px] pointer-events-none" />

      <div className="relative z-10 flex items-center gap-2 p-3 border-b-2 border-[#1a1a1a]">
        <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 2, repeat: Infinity }} className="w-1.5 h-1.5 bg-red-800 rounded-full" />
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-widest text-red-900 font-bold">{world.label}</div>
          <div className="text-[7px] text-[#555] truncate">{world.subtitle}</div>
        </div>
        <div className="ml-auto text-[8px] text-red-900/60 tracking-widest uppercase border border-red-900/30 px-1.5 py-0.5">S.O.S</div>
      </div>

      <div className="relative z-10 flex-1 p-3 flex flex-col" style={{ transform: 'rotate(-0.5deg)' }}>
        <div className="border-l-2 border-[#8a2a2a]/40 pl-2 mb-3" style={{ transform: 'skewX(-2deg)' }}>
          <div className="text-[8px] text-red-900/80 uppercase tracking-widest mb-1">Signal Lost</div>
          <motion.div className="space-y-1" animate={{ opacity: [0.6, 1, 0.6] }} transition={{ duration: 3, repeat: Infinity }}>
            <div className="h-1 bg-[#3a3a3a]/60 w-full" />
            <div className="h-1 bg-[#3a3a3a]/40 w-2/3" />
          </motion.div>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-auto">
          <div className="border border-[#2a2a2a] bg-black/40 p-2" style={{ transform: 'rotate(0.8deg)' }}>
            <div className="text-[8px] text-red-900/60">DRIFTER</div>
            <div className="text-[16px] font-black text-[#3a3a3a]">01</div>
          </div>
          <div className="border border-[#2a2a2a] bg-black/40 p-2" style={{ transform: 'rotate(-0.5deg)', marginTop: '8px' }}>
            <div className="text-[8px] text-red-900/60">MECHANIC</div>
            <div className="text-[16px] font-black text-[#3a3a3a]">02</div>
          </div>
        </div>

        <div className="mt-2 w-16 h-0.5 mx-auto bg-[#2a2a2a] opacity-50" style={{ clipPath: 'polygon(0 0, 100% 0, 95% 100%, 5% 100%)' }} />
        <div className="mt-2 bg-[#8a3a3a]/20 border border-red-900/40 text-red-900 text-center py-1.5 text-[8px] uppercase tracking-widest">
          ？？？
        </div>
      </div>

      <div className="absolute inset-0 border-2 border-transparent group-hover:border-red-900/30 transition-colors pointer-events-none" />
    </motion.div>
  );
}

function RitualPreview({ world, onSelect }: PreviewBoxProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => onSelect(world.type)}
      className="relative h-full bg-[#110e0c] text-[#d4af37] font-serif overflow-hidden cursor-pointer group flex flex-col"
    >
      <div className="absolute inset-0 bg-[#1a1512] opacity-20 mix-blend-overlay pointer-events-none" />
      <div className="absolute top-1 left-1 right-1 bottom-1 border border-[#8b6b23]/20 pointer-events-none" />

      <div className="relative z-10 flex items-center justify-center p-3 border-b border-[#8b6b23]/20">
        <div className="text-center">
          <div className="text-[10px] tracking-[0.3em] text-[#8b6b23] uppercase">{world.label}</div>
          <div className="text-[7px] text-[#8b6b23]/60 truncate">{world.subtitle}</div>
        </div>
      </div>

      <div className="relative z-10 flex-1 p-3 flex flex-col items-center justify-center">
        <motion.div
          animate={{ scale: [1, 1.04, 1], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 4, repeat: Infinity }}
          className="w-12 h-12 rounded-full border-2 border-[#8b6b23]/30 flex items-center justify-center mb-3"
        >
          <div className="w-6 h-6 rounded-full bg-[#d4af37]/10 border border-[#d4af37]/30" />
        </motion.div>

        <div className="text-center mb-3">
          <div className="text-[10px] text-[#e5c76b] tracking-widest uppercase border-b border-[#8b6b23]/30 pb-2 mb-2">
            Prophecy
          </div>
          <div className="space-y-1">
            <div className="h-1 bg-[#a88a44]/20 w-24 mx-auto" />
            <div className="h-1 bg-[#a88a44]/10 w-16 mx-auto" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 w-full mt-1">
          {['Arc', 'Inq', 'Alc'].map((name, i) => (
            <div key={i} className="bg-[#14100e] border border-[#8b6b23]/15 p-2 text-center">
              <div className="text-[8px] text-[#d4af37] font-bold">{name}</div>
              <div className="text-[6px] text-[#8b6b23] uppercase">Master</div>
            </div>
          ))}
        </div>

        <motion.button
          whileHover={{ scale: 1.05 }}
          className="mt-3 px-4 py-1.5 bg-[#8b6b23]/10 border border-[#8b6b23] text-[#d4af37] text-[8px] uppercase tracking-[0.3em] shadow-[0_0_10px_rgba(139,107,35,0.15)]"
        >
          Pledge
        </motion.button>
      </div>

      <div className="absolute inset-0 border border-transparent group-hover:border-[#d4af37]/20 transition-colors pointer-events-none" />
    </motion.div>
  );
}

const PREVIEWS: Record<WorldType, typeof AncientScrollPreview> = {
  'ancient-scroll': AncientScrollPreview,
  'cyber-hud': CyberHUDPreview,
  'broken': BrokenPreview,
  'ritual': RitualPreview,
};

const BG_COLORS: Record<WorldType, string> = {
  'ancient-scroll': '',
  'cyber-hud': '',
  'broken': '',
  'ritual': '',
};

export default function WorldSelector({ onSelect }: { onSelect: (type: WorldType) => void }) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-6"
        >
          <h1 className="text-xl font-bold text-white tracking-widest uppercase mb-2">选择世界</h1>
          <p className="text-xs text-zinc-500 tracking-wider">每个世界拥有完全不同的叙事语言</p>
        </motion.div>

        <div className="grid grid-cols-2 gap-3">
          {WORLDS.map((world, i) => {
            const Preview = PREVIEWS[world.type];
            return (
              <div key={world.type} className="h-[280px]">
                <Preview world={world} index={i} onSelect={onSelect} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
