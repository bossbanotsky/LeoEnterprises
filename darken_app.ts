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

  // Backgrounds to dark
  content = content.replace(/bg-white/g, 'bg-black');
  content = content.replace(/bg-slate-100/g, 'bg-slate-800');
  content = content.replace(/bg-slate-50/g, 'bg-slate-900');
  content = content.replace(/bg-stone-50/g, 'bg-black');

  // Text to white
  content = content.replace(/text-black/g, 'text-white');

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated ${file}`);
  }
});
