/**
 * Tests for CLI automation features, framework detection, deploy improvements.
 * Run: node --test tests/automation-features.test.js
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync, existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, '..', 'src');

// ── Framework Detection ──────────────────────────────────────────────────────

describe('Framework Detection', () => {
  let detectFramework;
  const tmpBase = join('/tmp', 'nometria-test-' + Date.now());

  // Dynamic import
  it('module loads', async () => {
    const mod = await import(join(SRC, 'lib', 'detect.js'));
    detectFramework = mod.detectFramework;
    assert.ok(typeof detectFramework === 'function');
  });

  function makeDir(name, files = [], pkg = null) {
    const dir = join(tmpBase, name);
    mkdirSync(dir, { recursive: true });
    for (const f of files) writeFileSync(join(dir, f), '');
    if (pkg) writeFileSync(join(dir, 'package.json'), JSON.stringify(pkg));
    return dir;
  }

  it('detects vite from config file', async () => {
    const dir = makeDir('vite', ['vite.config.js']);
    assert.equal(detectFramework(dir).framework, 'vite');
  });

  it('detects nextjs from config file', async () => {
    const dir = makeDir('next', ['next.config.mjs']);
    assert.equal(detectFramework(dir).framework, 'nextjs');
  });

  it('detects astro from config file', async () => {
    const dir = makeDir('astro', ['astro.config.mjs']);
    assert.equal(detectFramework(dir).framework, 'astro');
  });

  it('detects astro from dependency', async () => {
    const dir = makeDir('astro-dep', [], { dependencies: { astro: '4.0' } });
    assert.equal(detectFramework(dir).framework, 'astro');
  });

  it('detects sveltekit from config file', async () => {
    const dir = makeDir('svelte', ['svelte.config.js']);
    assert.equal(detectFramework(dir).framework, 'sveltekit');
  });

  it('detects nuxt from config file', async () => {
    const dir = makeDir('nuxt', ['nuxt.config.ts']);
    assert.equal(detectFramework(dir).framework, 'nuxt');
  });

  it('detects hono from dependency', async () => {
    const dir = makeDir('hono', [], { dependencies: { hono: '4.0' } });
    assert.equal(detectFramework(dir).framework, 'hono');
  });

  it('detects solid from dependencies', async () => {
    const dir = makeDir('solid', [], { dependencies: { 'solid-js': '1', 'solid-start': '1' } });
    assert.equal(detectFramework(dir).framework, 'solid');
  });

  it('detects node from scripts.start', async () => {
    const dir = makeDir('node', [], { scripts: { start: 'node index.js' } });
    assert.equal(detectFramework(dir).framework, 'node');
  });

  it('falls back to static with uncertain flag', async () => {
    const dir = makeDir('empty');
    const result = detectFramework(dir);
    assert.equal(result.framework, 'static');
    assert.equal(result.uncertain, true);
  });

  it('static from index.html has no uncertain flag', async () => {
    const dir = makeDir('html', ['index.html']);
    const result = detectFramework(dir);
    assert.equal(result.framework, 'static');
    assert.equal(result.uncertain, undefined);
  });

  // Cleanup
  it('cleanup temp dirs', () => {
    rmSync(tmpBase, { recursive: true, force: true });
  });
});

// ── Deploy.js Features ───────────────────────────────────────────────────────

describe('Deploy Command', () => {
  const deploySrc = readFileSync(join(SRC, 'commands', 'deploy.js'), 'utf8');

  it('has instance cost table', () => {
    assert.ok(deploySrc.includes('INSTANCE_COSTS'));
    assert.ok(deploySrc.includes("'2gb'"));
    assert.ok(deploySrc.includes("'16gb'"));
  });

  it('has poll timeout', () => {
    assert.ok(deploySrc.includes('POLL_TIMEOUT_MS'));
    assert.ok(deploySrc.includes('10 * 60 * 1000') || deploySrc.includes('10 minutes'));
  });

  it('handles consecutive errors', () => {
    assert.ok(deploySrc.includes('consecutiveErrors'));
    assert.ok(deploySrc.includes('consecutiveErrors >= 5'));
  });

  it('includes help URLs on failure', () => {
    assert.ok(deploySrc.includes('docs.nometria.com'));
    assert.ok(deploySrc.includes('nom logs'));
    assert.ok(deploySrc.includes('nom status'));
  });

  it('supports dry-run', () => {
    assert.ok(deploySrc.includes('dry-run'));
    assert.ok(deploySrc.includes('dryRun'));
    assert.ok(deploySrc.includes('function dryRun'));
  });

  it('uses ownmy.app only for instance URL fallback', () => {
    // ownmy.app is correct for deployed instance hostnames (infrastructure domain)
    // nometria.com is correct for API, dashboard, docs (brand domain)
    const ownmyRefs = deploySrc.match(/ownmy\.app/g) || [];
    assert.ok(ownmyRefs.length <= 1, `Should have at most 1 ownmy.app ref (fallback URL), got ${ownmyRefs.length}`);
    assert.ok(deploySrc.includes('docs.nometria.com'), 'Should use nometria.com for docs');
  });
});

// ── CLI Commands ─────────────────────────────────────────────────────────────

describe('CLI Commands', () => {
  const cliSrc = readFileSync(join(SRC, 'cli.js'), 'utf8');

  it('registers list command', () => {
    assert.ok(cliSrc.includes("import { list }"));
    assert.ok(cliSrc.includes('list,'));
  });

  it('registers rollback command', () => {
    assert.ok(cliSrc.includes("import { rollback }"));
    assert.ok(cliSrc.includes('rollback,'));
  });

  it('registers ssh command', () => {
    assert.ok(cliSrc.includes("import { ssh }"));
    assert.ok(cliSrc.includes('ssh,'));
  });

  it('has --dry-run flag', () => {
    assert.ok(cliSrc.includes("'dry-run'"));
  });

  it('has --preview and --production flags', () => {
    assert.ok(cliSrc.includes("preview:"));
    assert.ok(cliSrc.includes("production:"));
  });

  it('error handler includes help links', () => {
    assert.ok(cliSrc.includes('nometria.com/settings/api-keys'), 'Auth error should link to API keys page');
    assert.ok(cliSrc.includes('docs.nometria.com'), 'Should link to docs');
    assert.ok(cliSrc.includes('err.status === 402'), 'Should handle 402 payment required');
    assert.ok(cliSrc.includes('err.status === 404'), 'Should handle 404 not found');
    assert.ok(cliSrc.includes('err.status === 429'), 'Should handle 429 rate limit');
  });
});

// ── Env Command ──────────────────────────────────────────────────────────────

describe('Env Command', () => {
  const envSrc = readFileSync(join(SRC, 'commands', 'env.js'), 'utf8');

  it('has preview/production scope', () => {
    assert.ok(envSrc.includes('getScope'));
    assert.ok(envSrc.includes("'preview'"));
    assert.ok(envSrc.includes("'production'"));
  });

  it('detects secrets in values', () => {
    assert.ok(envSrc.includes('SECRET_PATTERNS'));
    assert.ok(envSrc.includes('looksLikeSecret'));
  });

  it('has compare subcommand', () => {
    assert.ok(envSrc.includes('envCompare'));
    assert.ok(envSrc.includes("case 'compare'"));
  });
});

// ── New Command Files Exist ──────────────────────────────────────────────────

describe('New Command Files', () => {
  for (const cmd of ['list', 'rollback', 'ssh']) {
    it(`${cmd}.js exists`, () => {
      assert.ok(existsSync(join(SRC, 'commands', `${cmd}.js`)), `Missing: commands/${cmd}.js`);
    });
  }
});
