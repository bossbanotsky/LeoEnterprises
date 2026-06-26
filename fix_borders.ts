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

  // Make all black borders white for dark mode
  content = content.replace(/border-black\/10/g, 'border-white/10');
  content = content.replace(/border-black\/20/g, 'border-white/20');
  content = content.replace(/border-black\/30/g, 'border-white/30');
  content = content.replace(/border-black\/40/g, 'border-white/40');
  content = content.replace(/border-black\/50/g, 'border-white/50');
  content = content.replace(/border-black/g, 'border-white/40');

  // Some overrides created bg-black/5 etc.
  content = content.replace(/bg-black\/5/g, 'bg-white/5');

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated ${file}`);
  }
});
