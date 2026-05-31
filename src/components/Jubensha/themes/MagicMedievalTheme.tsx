import { motion } from 'motion/react';
import { LogOut, Scroll, Shield } from 'lucide-react';
import type { ThemeProps } from './types';

export default function MagicMedievalTheme({ config, onStart, onExit }: ThemeProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, filter: 'blur(10px)' }}
      transition={{ duration: 1.2 }}
      className="min-h-screen bg-[#110e0c] text-[#d4af37] font-serif relative overflow-hidden"
    >
      <div className="absolute inset-0 bg-[#1a1512] opacity-20 pointer-events-none mix-blend-overlay" />

      {/* Decorative Ornate Borders */}
      <div className="absolute top-4 left-4 right-4 bottom-4 border-2 border-[#8b6b23]/30 pointer-events-none" />
      <div className="absolute top-6 left-6 right-6 bottom-6 border border-[#8b6b23]/20 pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 p-8 flex justify-between items-center text-center">
        <button onClick={onExit} className="text-[#8b6b23] hover:text-[#d4af37] transition-colors p-2 flex items-center gap-2">
          <LogOut className="w-5 h-5" />
          <span className="uppercase tracking-widest text-sm">Flee</span>
        </button>

        <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
          <Shield className="w-8 h-8 text-[#8b6b23] mb-2" />
          <h1 className="text-2xl font-bold tracking-[0.2em] text-[#d4af37] uppercase">
            {config.background}
          </h1>
          <div className="text-xs tracking-[0.3em] text-[#8b6b23] uppercase">~ {config.theme} ~</div>
        </div>

        <div className="w-12 h-12" /> {/* Layout balancer */}
      </header>

      {/* Content */}
      <main className="relative z-10 p-8 max-w-5xl mx-auto mt-16 flex flex-col items-center">

        <div className="bg-[#1f1915] border border-[#8b6b23]/40 p-12 relative max-w-3xl text-center shadow-2xl">
          <Scroll className="w-10 h-10 text-[#8b6b23] absolute -top-5 left-1/2 -translate-x-1/2 bg-[#1f1915] px-2" />

          <h2 className="text-3xl tracking-wider text-[#e5c76b] mb-8 uppercase border-b border-[#8b6b23]/30 pb-6">
            The Chronicle of Shadows
          </h2>
          <p className="text-lg leading-relaxed text-[#a88a44] text-justify">
            The ancient prophecy spoke of a night when the twin moons align over the Academy's spire.
            The Headmaster lies dead in his locked chambers, his wand shattered into dust.
            You, the remaining council members, are sealed within the grand hall.
            The defensive wards are failing. The suspect is among you.
            Magic cannot solve a mystery of blood and malice.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16 w-full max-w-3xl">
          {[
            { role: 'The Archmage', desc: 'Master of Arcane' },
            { role: 'The Inquisitor', desc: 'Seeker of Truth' },
            { role: 'The Alchemist', desc: 'Brewer of Secrets' }
          ].map((ch, idx) => (
            <div key={idx} className="bg-[#14100e] border border-[#8b6b23]/20 p-6 text-center hover:bg-[#1a1512] transition-colors hover:border-[#8b6b23]/50 cursor-pointer group">
              <h3 className="text-xl text-[#d4af37] mb-2 font-bold group-hover:scale-105 transition-transform">{ch.role}</h3>
              <p className="text-sm text-[#8b6b23] tracking-widest uppercase">{ch.desc}</p>
            </div>
          ))}
        </div>

        <button onClick={onStart} className="mt-16 px-16 py-4 bg-[#8b6b23]/10 border border-[#8b6b23] text-[#d4af37] hover:bg-[#d4af37] hover:text-[#110e0c] transition-all tracking-[0.3em] uppercase text-xl font-bold shadow-[0_0_20px_rgba(139,107,35,0.2)]">
          Pledge Allegiance
        </button>

      </main>
    </motion.div>
  );
}
