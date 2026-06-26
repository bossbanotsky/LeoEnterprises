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

  // Make all light borders darker
  content = content.replace(/border-amber-600\/10/g, 'border-black/30');
  content = content.replace(/border-amber-500\/20/g, 'border-black/40');
  content = content.replace(/border-stone-200\/20/g, 'border-black/30');
  content = content.replace(/border-stone-700\/50/g, 'border-black/40');
  content = content.replace(/border-white\/10/g, 'border-black/30');
  content = content.replace(/border-white\/5/g, 'border-black/20');
  content = content.replace(/border-slate-100/g, 'border-black/20');
  content = content.replace(/border-slate-200/g, 'border-black/30');
  content = content.replace(/border-slate-700/g, 'border-black/50');
  content = content.replace(/border-amber-600\/15/g, 'border-black/40');

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated ${file}`);
  }
});
