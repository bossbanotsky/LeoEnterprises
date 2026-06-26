import fs from 'fs';
import path from 'path';

function walkDir(dir: string, callback: (file: string) => void) {
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      walkDir(file, callback);
    } else {
      if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        callback(file);
      }
    }
  });
}

walkDir('./src', (file) => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // Ensure all text is black or dark
  content = content.replace(/text-white/g, 'text-black');
  // Also check for other light text classes if any
  content = content.replace(/text-stone-100/g, 'text-black');
  content = content.replace(/text-slate-100/g, 'text-black');
  content = content.replace(/text-gray-100/g, 'text-black');

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated ${file}`);
  }
});
