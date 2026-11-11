// Falla el build si una plantilla o un .ts usa un ícono `bi-*` / `ti-*` que no está en src/icons/icons.css.
// Se corre solo con `npm run build` (prebuild). Para regenerar el subconjunto: scripts/icons/build-icon-subset.py
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const TOKEN = /(?<![\w-])((?:bi|ti)-[a-z0-9]+(?:-[a-z0-9]+)*)/g;

function sourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(html|ts)$/.test(entry.name) && !entry.name.endsWith('.spec.ts') ? [path] : [];
  });
}

function definedIn(cssPath, pattern) {
  return new Set([...readFileSync(cssPath, 'utf8').matchAll(pattern)].map(match => match[1]));
}

const library = new Set([
  ...definedIn(join(root, 'node_modules/bootstrap-icons/font/bootstrap-icons.css'), /\.(bi-[a-z0-9-]+)::before/g),
  ...definedIn(join(root, 'node_modules/@tabler/icons-webfont/dist/tabler-icons.min.css'), /\.(ti-[a-z0-9-]+):before/g)
]);
const subset = definedIn(join(root, 'src/icons/icons.css'), /\.((?:bi|ti)-[a-z0-9-]+)(?:::|:)before/g);

const missing = new Map();
for (const file of sourceFiles(join(root, 'src'))) {
  for (const [, token] of readFileSync(file, 'utf8').matchAll(TOKEN)) {
    if (library.has(token) && !subset.has(token)) missing.set(token, file.slice(root.length + 1));
  }
}

if (missing.size > 0) {
  console.error('Íconos usados que faltan en src/icons/icons.css:');
  for (const [token, file] of missing) console.error(`  ${token}  (${file})`);
  console.error('Regenerar con: python3 scripts/icons/build-icon-subset.py (ver la cabecera del script).');
  process.exit(1);
}
console.log(`Íconos: los ${subset.size} usados están en src/icons/icons.css.`);
