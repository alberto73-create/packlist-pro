import { readFileSync, writeFileSync } from 'node:fs';

const version = process.argv[2]?.trim();
if (!/^\d+\.\d+\.\d+$/.test(version || '')) {
  console.error('Uso: npm run bump:version -- 1.10.22');
  process.exit(1);
}

const files = ['index.html', 'js/modules/db.js', 'sw.js', 'manifest.json'];
const replacements = [
  [/1\.\d+\.\d+/g, version],
  [/packlist-v1\.\d+\.\d+/g, `packlist-v${version}`]
];

for (const file of files) {
  let content = readFileSync(file, 'utf8');
  for (const [pattern, replacement] of replacements) content = content.replace(pattern, replacement);
  writeFileSync(file, content);
}

console.log(`Versione Packlist Pro aggiornata a ${version} in ${files.join(', ')}`);
