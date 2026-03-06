const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'src', 'components');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));

files.forEach(file => {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace common light/dark classes with Monarch dark theme classes
  content = content.replace(/bg-white dark:bg-\[#18181b\]/g, 'bg-[#1e1e1e]');
  content = content.replace(/bg-white dark:bg-zinc-800/g, 'bg-[#1e1e1e]');
  content = content.replace(/bg-white dark:bg-zinc-900/g, 'bg-[#1e1e1e]');
  content = content.replace(/bg-zinc-50 dark:bg-\[#09090b\]/g, 'bg-[#141414]');
  content = content.replace(/bg-zinc-50 dark:bg-\[#050505\]/g, 'bg-[#141414]');
  
  // Cards and panels
  content = content.replace(/glass-panel/g, 'bg-[#1e1e1e] border border-white/5 rounded-2xl shadow-xl');
  content = content.replace(/bg-black\/5 dark:bg-white\/5/g, 'bg-[#252525]');
  content = content.replace(/bg-black\/5 dark:bg-black\/20/g, 'bg-[#1a1a1a]');
  content = content.replace(/bg-black\/10 dark:bg-white\/10/g, 'bg-[#2a2a2a]');
  
  // Borders
  content = content.replace(/border-black\/5 dark:border-white\/10/g, 'border-white/5');
  content = content.replace(/border-black\/5 dark:border-white\/5/g, 'border-white/5');
  content = content.replace(/border-black\/10 dark:border-white\/10/g, 'border-white/10');
  content = content.replace(/border-black\/10 dark:border-white\/20/g, 'border-white/10');
  
  // Text
  content = content.replace(/text-zinc-900 dark:text-white/g, 'text-white');
  content = content.replace(/text-zinc-900 dark:text-\[#fafafa\]/g, 'text-white');
  content = content.replace(/text-zinc-800 dark:text-zinc-200/g, 'text-zinc-200');
  content = content.replace(/text-zinc-700 dark:text-zinc-300/g, 'text-zinc-300');
  content = content.replace(/text-zinc-600 dark:text-zinc-400/g, 'text-zinc-400');
  content = content.replace(/text-zinc-500 dark:text-zinc-400/g, 'text-zinc-400');
  content = content.replace(/text-zinc-500 dark:text-zinc-500/g, 'text-zinc-500');
  
  // Hover states
  content = content.replace(/hover:bg-black\/5 dark:hover:bg-white\/5/g, 'hover:bg-white/[0.02]');
  content = content.replace(/hover:bg-black\/10 dark:hover:bg-white\/10/g, 'hover:bg-white/[0.04]');
  
  fs.writeFileSync(filePath, content);
});

console.log('Theme updated across all components.');
