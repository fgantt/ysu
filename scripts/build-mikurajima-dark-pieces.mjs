import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Keep the established piece geometry and vector kanji; replace only the wood base.
const source = 'public/piece-themes/mikurajima-moriage';
const destination = 'public/piece-themes/mikurajima-moriage-dark';
const base64 = readFileSync(join(destination, 'piece-base.png')).toString('base64');
const imagePattern = /data:image\/png;base64,[^"]+/;
const files = readdirSync(source).filter(name => name.endsWith('.svg'));

if (files.length !== 30) throw new Error(`Expected 30 source piece SVGs, found ${files.length}`);

for (const name of files) {
  const original = readFileSync(join(source, name), 'utf8');
  if (!imagePattern.test(original)) throw new Error(`Missing embedded piece base: ${name}`);
  const dark = original.replace(imagePattern, `data:image/png;base64,${base64}`);
  writeFileSync(join(destination, name), dark);
}

console.log(`Built ${files.length} dark Mikurajima piece SVGs.`);
