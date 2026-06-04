const fs = require('fs');
const path = require('path');

function processFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');
  let newContent = content.replace(/\s?dark:[^\s'"`{}]+/g, '');
  
  if (content !== newContent) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`Cleaned: ${filePath}`);
  }
}

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== 'dist') walk(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts') || fullPath.endsWith('.css') || fullPath.endsWith('.html')) {
      processFile(fullPath);
    }
  }
}

const rootDir = process.cwd();
const srcDir = path.join(rootDir, 'src');

if (fs.existsSync(srcDir)) {
  walk(srcDir);
}
// Also process index.html in root
processFile(path.join(rootDir, 'index.html'));

console.log('Dark mode class removal complete.');
