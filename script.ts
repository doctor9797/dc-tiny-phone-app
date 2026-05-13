import fs from 'fs';

let code = fs.readFileSync('src/components/WorldBook/WorldBookApp.tsx', 'utf8');
code = code.replace(/bg-emerald-50 dark:bg-emerald-950/g, '${t.bg}');
code = code.replace(/text-emerald-900 dark:text-emerald-50/g, '${t.text}');
code = code.replace(/bg-emerald-100\/50 dark:bg-emerald-900\/50/g, '${t.header}');
code = code.replace(/border-emerald-200 dark:border-emerald-800/g, '${t.border}');
code = code.replace(/text-emerald-700 dark:text-emerald-400/g, '${t.prim}');
code = code.replace(/border-emerald-300 dark:border-emerald-700/g, '${t.inputBorder}');
code = code.replace(/bg-emerald-100 dark:bg-emerald-900/g, '${t.panel}');
code = code.replace(/active:bg-emerald-200 dark:active:bg-emerald-800/g, '${t.active}');

// Fix the classes to be template strings
code = code.replace(/className="([^"]*\$\{t\.[a-zA-Z]+\}[^"]*)"/g, 'className={`$1`}');

// Inject the mapping
const mapping = `
const getT = (theme: string) => {
  const t: Record<string, any> = {
    cyan: { bg: 'bg-cyan-50 dark:bg-cyan-950', text: 'text-cyan-900 dark:text-cyan-50', header: 'bg-cyan-100/50 dark:bg-cyan-900/50', border: 'border-cyan-200 dark:border-cyan-800', prim: 'text-cyan-700 dark:text-cyan-400', inputBorder: 'border-cyan-300 dark:border-cyan-700', panel: 'bg-cyan-100 dark:bg-cyan-900', active: 'active:bg-cyan-200 dark:active:bg-cyan-800' },
    pink: { bg: 'bg-pink-50 dark:bg-pink-950', text: 'text-pink-900 dark:text-pink-50', header: 'bg-pink-100/50 dark:bg-pink-900/50', border: 'border-pink-200 dark:border-pink-800', prim: 'text-pink-700 dark:text-pink-400', inputBorder: 'border-pink-300 dark:border-pink-700', panel: 'bg-pink-100 dark:bg-pink-900', active: 'active:bg-pink-200 dark:active:bg-pink-800' },
    white: { bg: 'bg-slate-50 dark:bg-[#121212]', text: 'text-slate-900 dark:text-slate-50', header: 'bg-white dark:bg-[#191919]', border: 'border-slate-200 dark:border-white/10', prim: 'text-slate-700 dark:text-slate-300', inputBorder: 'border-slate-300 dark:border-white/10', panel: 'bg-white dark:bg-[#2c2c2c]', active: 'active:bg-slate-200 dark:active:bg-[#2c2c2c]' },
    green: { bg: 'bg-emerald-50 dark:bg-emerald-950', text: 'text-emerald-900 dark:text-emerald-50', header: 'bg-emerald-100/50 dark:bg-emerald-900/50', border: 'border-emerald-200 dark:border-emerald-800', prim: 'text-emerald-700 dark:text-emerald-400', inputBorder: 'border-emerald-300 dark:border-emerald-700', panel: 'bg-emerald-100 dark:bg-emerald-900', active: 'active:bg-emerald-200 dark:active:bg-emerald-800' },
    purple: { bg: 'bg-purple-50 dark:bg-purple-950', text: 'text-purple-900 dark:text-purple-50', header: 'bg-purple-100/50 dark:bg-purple-900/50', border: 'border-purple-200 dark:border-purple-800', prim: 'text-purple-700 dark:text-purple-400', inputBorder: 'border-purple-300 dark:border-purple-700', panel: 'bg-purple-100 dark:bg-purple-900', active: 'active:bg-purple-200 dark:active:bg-purple-800' },
    black: { bg: 'bg-zinc-100 dark:bg-black', text: 'text-zinc-900 dark:text-zinc-50', header: 'bg-zinc-200/50 dark:bg-zinc-900/50', border: 'border-zinc-300 dark:border-white/10', prim: 'text-zinc-700 dark:text-zinc-300', inputBorder: 'border-zinc-400 dark:border-white/20', panel: 'bg-zinc-200 dark:bg-[#191919]', active: 'active:bg-zinc-300 dark:active:bg-[#2c2c2c]' },
    gray: { bg: 'bg-gray-50 dark:bg-gray-900', text: 'text-gray-900 dark:text-gray-50', header: 'bg-gray-200/50 dark:bg-gray-800/50', border: 'border-gray-200 dark:border-gray-700', prim: 'text-gray-700 dark:text-gray-300', inputBorder: 'border-gray-300 dark:border-gray-600', panel: 'bg-gray-200 dark:bg-gray-800', active: 'active:bg-gray-300 dark:active:bg-gray-700' },
  }
  return t[theme] || t.green;
}
`;

code = code.replace(/export default function WorldBookApp\(\) \{/, mapping + '\nexport default function WorldBookApp() {\n  const t = getT(useAppStore.getState().settings.osTheme || "green");');

fs.writeFileSync('src/components/WorldBook/WorldBookApp.tsx', code);
