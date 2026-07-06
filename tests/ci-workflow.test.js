/**
 * Tests for the env-file parser and GitHub Actions workflow generator.
 * Run: node --test tests/ci-workflow.test.js
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, '..', 'src');

describe('envFile.parseEnv', () => {
  let m;
  it('module loads', async () => { m = await import(join(SRC, 'lib', 'envFile.js')); assert.ok(m.parseEnv); });

  it('parses KEY=VALUE, export, quotes, comments', () => {
    const out = m.parseEnv('# c\nexport A=1\nB="hello world"\nC=3 # inline\n\n');
    assert.equal(out.length, 3);
    assert.deepEqual(out.map(e => [e.key, e.value]), [['A', '1'], ['B', 'hello world'], ['C', '3']]);
  });

  it('flags secrets and bad lines', () => {
    const out = m.parseEnv('API_SECRET=sk_live_x\nNOPE\nPORT=3000');
    assert.equal(out.find(e => e.key === 'API_SECRET').secret, true);
    assert.equal(out.find(e => e.key === 'PORT').secret, false);
    assert.equal(out.find(e => e.key === 'NOPE').error, 'missing "="');
  });

  it('toEnvConfig routes secrets through @env:', () => {
    const cfg = m.toEnvConfig(m.parseEnv('API_SECRET=sk_x\nFOO=bar'));
    assert.equal(cfg.API_SECRET, '@env:API_SECRET');
    assert.equal(cfg.FOO, 'bar');
  });

  it('allSecret forces every var through @env:', () => {
    const cfg = m.toEnvConfig(m.parseEnv('FOO=bar'), { allSecret: true });
    assert.equal(cfg.FOO, '@env:FOO');
  });

  it('secretKeys lists referenced vars', () => {
    assert.deepEqual(m.secretKeys({ A: '@env:A', B: 'plain' }), ['A']);
  });
});

describe('ciWorkflow.generateWorkflow', () => {
  let cw;
  it('module loads', async () => { cw = await import(join(SRC, 'lib', 'ciWorkflow.js')); assert.ok(cw.generateWorkflow); });

  it('includes deploy step and api key secret', () => {
    const wf = cw.generateWorkflow({ config: { name: 'x', env: {} }, packageManager: 'npm' });
    assert.match(wf, /npx @nometria-ai\/nom deploy --yes/);
    assert.match(wf, /NOMETRIA_API_KEY: \$\{\{ secrets\.NOMETRIA_API_KEY \}\}/);
    assert.match(wf, /npm ci/);
  });

  it('wires @env: secrets into the env block', () => {
    const wf = cw.generateWorkflow({ config: { name: 'x', env: { DB: '@env:DB' } } });
    assert.match(wf, /DB: \$\{\{ secrets\.DB \}\}/);
    assert.deepEqual(cw.requiredSecrets({ env: { DB: '@env:DB' } }), ['NOMETRIA_API_KEY', 'DB']);
  });

  it('pnpm uses action-setup and frozen lockfile', () => {
    const wf = cw.generateWorkflow({ config: { name: 'x' }, packageManager: 'pnpm' });
    assert.match(wf, /pnpm\/action-setup@v4/);
    assert.match(wf, /pnpm install --frozen-lockfile/);
  });

  it('preview mode adds a pull_request preview job', () => {
    const wf = cw.generateWorkflow({ config: { name: 'x' }, preview: true });
    assert.match(wf, /pull_request:/);
    assert.match(wf, /nom preview --yes/);
  });
});
