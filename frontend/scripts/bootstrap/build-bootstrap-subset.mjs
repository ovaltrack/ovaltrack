// Genera src/bootstrap/bootstrap-subset.css: bootstrap.min.css con solo las reglas que pueden aplicar a esta app.
//
// Criterio: se conserva, tal cual y en el mismo orden, toda regla cuyos selectores no mencionan clases (reboot, :root, etiquetas)
// o cuyas clases (fuera de :not) aparecen como palabra en alguna plantilla o .ts de src/. Una regla que menciona una clase que
// ninguna plantilla ni .ts nombra no puede coincidir con ningún elemento, así que quitarla no cambia qué regla gana en ninguno.
// Los @keyframes se conservan si una regla conservada los usa.
//
// Uso (dentro del contenedor, desde frontend/):
//   docker exec -u "$(id -u):$(id -g)" ovaltrack-frontend node scripts/bootstrap/build-bootstrap-subset.mjs   regenera el archivo (cuando una pantalla usa una clase nueva de Bootstrap)
//   node scripts/bootstrap/build-bootstrap-subset.mjs --check   falla si el archivo commiteado no coincide (corre en `npm run build`)
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const SOURCE = join(root, 'node_modules/bootstrap/dist/css/bootstrap.min.css');
const OUTPUT = join(root, 'src/bootstrap/bootstrap-subset.css');

function sourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(html|ts)$/.test(entry.name) && !entry.name.endsWith('.spec.ts') ? [path] : [];
  });
}

function vocabulary() {
  const words = new Set();
  for (const file of sourceFiles(join(root, 'src'))) {
    for (const [word] of readFileSync(file, 'utf8').matchAll(/[A-Za-z][\w-]*/g)) words.add(word);
  }
  return words;
}

function closingBrace(css, open) {
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '"' || css[i] === "'") i = css.indexOf(css[i], i + 1);
    else if (css[i] === '{') depth++;
    else if (css[i] === '}' && --depth === 0) return i;
  }
  throw new Error('Llave sin cerrar en bootstrap.min.css');
}

function splitTopLevel(text, separator) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '"' || text[i] === "'") i = text.indexOf(text[i], i + 1);
    else if (text[i] === '(' || text[i] === '[') depth++;
    else if (text[i] === ')' || text[i] === ']') depth--;
    else if (text[i] === separator && depth === 0) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return parts;
}

function classesOf(selector) {
  let plain = selector.replace(/\[[^\]]*\]/g, '');
  const group = /:(?:not|is|where|has)\([^()]*\)/g;
  while (group.test(plain)) plain = plain.replace(group, '');
  return [...plain.matchAll(/\.((?:\\.|[\w-])+)/g)].map(match => match[1].replace(/\\/g, ''));
}

function filterRules(css, words, keyframes) {
  let out = '';
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf('{', i);
    if (open < 0) break;
    const prelude = css.slice(i, open).trim();
    const close = closingBrace(css, open);
    const body = css.slice(open + 1, close);
    i = close + 1;
    if (prelude.startsWith('@keyframes')) {
      keyframes.set(prelude.split(/\s+/)[1], `${prelude}{${body}}`);
    } else if (prelude.startsWith('@')) {
      const inner = filterRules(body, words, keyframes);
      if (inner) out += `${prelude}{${inner}}`;
    } else {
      const kept = splitTopLevel(prelude, ',').filter(selector => classesOf(selector).every(name => words.has(name)));
      if (kept.length > 0) out += `${kept.join(',')}{${body}}`;
    }
  }
  return out;
}

export function buildSubset() {
  const source = readFileSync(SOURCE, 'utf8').replace(/\/\*# sourceMappingURL=.*?\*\/\s*$/, '');
  const header = source.slice(0, source.indexOf('*/') + 2);
  const keyframes = new Map();
  const rules = filterRules(source.slice(header.length), vocabulary(), keyframes);
  const used = [...keyframes].filter(([name]) => new RegExp(`[\\s:,]${name}[\\s;,}]`).test(rules)).map(([, text]) => text);
  return `${header}\n${rules}${used.join('')}\n`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const subset = buildSubset();
  if (process.argv.includes('--check')) {
    if (subset !== readFileSync(OUTPUT, 'utf8')) {
      console.error('src/bootstrap/bootstrap-subset.css no coincide con las clases que usan las pantallas.');
      console.error('Regenerar con: node scripts/bootstrap/build-bootstrap-subset.mjs (dentro del contenedor, desde frontend/).');
      process.exit(1);
    }
    console.log(`Bootstrap: src/bootstrap/bootstrap-subset.css al día (${subset.length} B).`);
  } else {
    writeFileSync(OUTPUT, subset);
    console.log(`src/bootstrap/bootstrap-subset.css: ${subset.length} B`);
  }
}
