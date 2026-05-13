import fs from 'fs';
const file = 'src/components/WorldBook/WorldBookApp.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace amber theme with fresh green/emerald theme
content = content.replace(/bg-amber-50/g, 'bg-emerald-50 dark:bg-emerald-950');
content = content.replace(/text-amber-900/g, 'text-emerald-900 dark:text-emerald-50');
content = content.replace(/text-amber-700/g, 'text-emerald-700 dark:text-emerald-400');
content = content.replace(/text-amber-600/g, 'text-emerald-600 dark:text-emerald-500');
content = content.replace(/text-amber-500\/50/g, 'text-emerald-500/50');
content = content.replace(/bg-amber-100\/50/g, 'bg-emerald-100/50 dark:bg-emerald-900/50');
content = content.replace(/bg-amber-100/g, 'bg-emerald-100 dark:bg-emerald-900');
content = content.replace(/border-amber-200/g, 'border-emerald-200 dark:border-emerald-800');
content = content.replace(/border-amber-300/g, 'border-emerald-300 dark:border-emerald-700');
content = content.replace(/bg-amber-500/g, 'bg-emerald-500 dark:bg-emerald-600');
content = content.replace(/hover:bg-amber-600/g, 'hover:bg-emerald-600 dark:hover:bg-emerald-500');
content = content.replace(/text-amber-800/g, 'text-emerald-800 dark:text-emerald-200');
content = content.replace(/bg-amber-900\/10/g, 'bg-emerald-900/10 dark:bg-emerald-400/10');
content = content.replace(/active:bg-amber-200/g, 'active:bg-emerald-200 dark:active:bg-emerald-800');

fs.writeFileSync(file, content);
