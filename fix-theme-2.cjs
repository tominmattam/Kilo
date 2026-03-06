const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'src', 'components');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));

files.forEach(file => {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace remaining light mode classes
  content = content.replace(/bg-white dark:bg-\[#1a1d24\]/g, 'bg-[#1e1e1e]');
  content = content.replace(/bg-white dark:bg-\[#09090b\]/g, 'bg-[#141414]');
  content = content.replace(/bg-white dark:bg-\[#18181b\]/g, 'bg-[#1e1e1e]');
  
  fs.writeFileSync(filePath, content);
});

console.log('Theme updated across all components.');
