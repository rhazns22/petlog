const fs = require('fs');
const path = require('path');

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // Find all className="something" or className={`something`}
  // Actually, we can just replace the class strings globally.
  // A simple approach: match any shadow class that is not dark:shadow...
  // and inject dark:shadow-none.

  // Regex to match shadow classes: shadow-[a-zA-Z0-9_\[\]\-]+ or drop-shadow-[a-zA-Z0-9_\[\]\-]+
  // But doing this per line or per string is safer.
  
  // A simpler Regex that works well for Tailwind:
  // Replace `shadow-[^\s'"]+` -> check if line has `dark:shadow-none`.
  // If we just add `dark:shadow-none` to the end of the class list, it's safer.
  
  content = content.split('\n').map(line => {
    // If line has a shadow class
    if (/(?<!dark:)(?:drop-)?shadow-(?!none)[^\s'"`]+/.test(line)) {
      if (!line.includes('dark:shadow-none')) {
         // replace the first closing quote or backtick with " dark:shadow-none"
         // Wait, there could be multiple strings on a line.
         // Let's replace the matched shadow class with itself + " dark:shadow-none"
         // but that could duplicate if multiple shadows are on the same line.
         line = line.replace(/(className\s*=\s*["`{])(.*?)(["`}])/g, (match, p1, p2, p3) => {
            if (/(?<!dark:)(?:drop-)?shadow-(?!none)[^\s'"`]+/.test(p2) && !p2.includes('dark:shadow-none')) {
                // If it's drop-shadow, we might want dark:drop-shadow-none but dark:shadow-none usually works if it's box-shadow. For drop-shadow, we need dark:drop-shadow-none.
                let appended = p2;
                if (/(?<!dark:)drop-shadow-[^\s'"`]+/.test(p2) && !p2.includes('dark:drop-shadow-none')) {
                    appended += " dark:drop-shadow-none";
                }
                if (/(?<!dark:)(?<!drop-)shadow-[^\s'"`]+/.test(p2) && !p2.includes('dark:shadow-none')) {
                    appended += " dark:shadow-none";
                }
                return p1 + appended + p3;
            }
            return match;
         });
      }
    }
    return line;
  }).join('\n');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated: ${filePath}`);
  }
}

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walk(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      processFile(fullPath);
    }
  }
}

walk(path.join(__dirname, 'src'));
console.log('Done');
