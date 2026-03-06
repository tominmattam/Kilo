const fs = require('fs');
const path = require('path');

function replaceColorsInDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      replaceColorsInDir(filePath);
    } else if (filePath.endsWith('.tsx') || filePath.endsWith('.ts') || filePath.endsWith('.css')) {
      let content = fs.readFileSync(filePath, 'utf8');
      let newContent = content.replace(/#e85d04/g, '#8b5cf6').replace(/#ff7a29/g, '#a78bfa');
      if (content !== newContent) {
        fs.writeFileSync(filePath, newContent, 'utf8');
        console.log(`Updated ${filePath}`);
      }
    }
  }
}

replaceColorsInDir(path.join(__dirname, 'src'));
console.log('Done replacing colors.');
