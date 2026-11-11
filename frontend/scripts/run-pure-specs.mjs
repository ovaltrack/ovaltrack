// Corre en Node los specs Jasmine que no necesitan navegador (funciones puras de utils/ y stores sin inject()), sin Karma ni Chrome.
// Empaqueta con esbuild y ejecuta con jasmine-core; ambos ya vienen con `npm install` (esbuild lo trae @angular-devkit/build-angular).
// Uso (dentro del contenedor): node scripts/run-pure-specs.mjs [carpeta-o-archivo ...]
// Desde el host: ./ds test-front [carpeta-o-archivo ...]
// Los specs que usan TestBed / HttpTestingController se omiten: esos requieren Karma.
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const root = resolve(import.meta.dirname, '..');
const DEFAULT_TARGETS = ['src/app/features/match/post-match/utils', 'src/app/features/match/post-match/store', 'src/app/shared/utils'];
const NEEDS_BROWSER = /TestBed|@angular\/core\/testing|@angular\/common\/http\/testing/;

function collectSpecs(target) {
  const path = resolve(root, target);
  if (statSync(path).isFile()) return [path];
  return readdirSync(path, { withFileTypes: true }).flatMap(entry => {
    const full = join(path, entry.name);
    if (entry.isDirectory()) return collectSpecs(relative(root, full));
    return entry.name.endsWith('.spec.ts') ? [full] : [];
  });
}

const targets = process.argv.length > 2 ? process.argv.slice(2) : DEFAULT_TARGETS;
const all = targets.flatMap(collectSpecs).sort();
const skipped = all.filter(file => NEEDS_BROWSER.test(readFileSync(file, 'utf8')));
const specs = all.filter(file => !skipped.includes(file));

if (specs.length === 0) {
  console.error('No se encontraron specs puros en:', targets.join(', '));
  process.exit(1);
}

const workDir = mkdtempSync(join(tmpdir(), 'pure-specs-'));
const bundlePath = join(workDir, 'bundle.cjs');

try {
  await build({
    stdin: {
      contents: specs.map(file => `import ${JSON.stringify(file)};`).join('\n'),
      resolveDir: root,
      loader: 'ts'
    },
    outfile: bundlePath,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    tsconfig: join(root, 'tsconfig.json'),
    logLevel: 'error'
  });

  const jasmineRequire = require('jasmine-core');
  const jasmine = jasmineRequire.core(jasmineRequire);
  const env = jasmine.getEnv();
  Object.assign(globalThis, jasmineRequire.interface(jasmine, env));
  env.configure({ random: false });

  const failures = [];
  let executed = 0;
  const finished = new Promise(done => {
    env.addReporter({
      specDone: result => {
        if (result.status === 'passed' || result.status === 'failed') executed++;
        if (result.status === 'failed') failures.push(result);
      },
      jasmineDone: done
    });
  });

  require(bundlePath);
  env.execute();
  const summary = await finished;

  for (const failure of failures) {
    console.error(`\nFALLÓ: ${failure.fullName}`);
    for (const expectation of failure.failedExpectations) console.error(`  ${expectation.message}`);
  }
  for (const error of summary.failedExpectations ?? []) console.error(`\nERROR GLOBAL: ${error.message}`);

  console.log(`\nSpecs puros: ${specs.length} archivos, ${executed} pruebas, ${failures.length} fallidas.`);
  if (skipped.length > 0) {
    console.log(`Omitidos (requieren Karma): ${skipped.map(file => relative(root, file)).join(', ')}`);
  }
  process.exitCode = summary.overallStatus === 'passed' && executed > 0 ? 0 : 1;
} finally {
  rmSync(workDir, { recursive: true, force: true });
}
