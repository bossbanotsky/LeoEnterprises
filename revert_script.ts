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

  // Backgrounds to white
  content = content.replace(/bg-black/g, 'bg-white');
  content = content.replace(/bg-slate-900/g, 'bg-white');
  content = content.replace(/bg-slate-800/g, 'bg-slate-100');
  content = content.replace(/bg-slate-950/g, 'bg-white');

  // Text to black
  content = content.replace(/text-white/g, 'text-black');

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated ${file}`);
  }
});
