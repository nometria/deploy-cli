import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI = join(__dirname, '..', 'src', 'cli.js');

describe('nom CLI', () => {
  it('shows version', () => {
    const out = execSync(`node ${CLI} --version`, { encoding: 'utf8' }).trim();
    assert.match(out, /^\d+\.\d+\.\d+$/);
  });

  it('shows help', () => {
    const out = execSync(`node ${CLI} --help`, { encoding: 'utf8' });
    assert.ok(out.includes('nom'));
    assert.ok(out.includes('deploy'));
    assert.ok(out.includes('login'));
    assert.ok(out.includes('status'));
  });

  it('exits with error for unknown command', () => {
    assert.throws(() => {
      execSync(`node ${CLI} nonexistent-command 2>&1`, { encoding: 'utf8' });
    });
  });
});

describe('config module', () => {
  it('exports readConfig and validate functions', async () => {
    const config = await import('../src/lib/config.js');
    assert.ok(typeof config.readConfig === 'function');
    assert.ok(typeof config.configExists === 'function');
    assert.ok(typeof config.updateConfig === 'function');
    assert.ok(typeof config.resolveEnv === 'function');
  });

  it('validates platform', async () => {
    const { VALID_PLATFORMS } = await import('../src/lib/config.js');
    assert.ok(VALID_PLATFORMS.includes('aws'));
    assert.ok(VALID_PLATFORMS.includes('vercel'));
    assert.ok(!VALID_PLATFORMS.includes('heroku'));
  });
});

describe('detect module', () => {
  it('detects static framework for empty dir', async () => {
    const { detectFramework } = await import('../src/lib/detect.js');
    const result = detectFramework('/tmp');
    assert.equal(result.framework, 'static');
  });

  it('detects package manager', async () => {
    const { detectPackageManager } = await import('../src/lib/detect.js');
    const pm = detectPackageManager('/tmp');
    assert.equal(pm, 'npm');
  });
});

describe('auth module', () => {
  it('exports required functions', async () => {
    const auth = await import('../src/lib/auth.js');
    assert.ok(typeof auth.getApiKey === 'function');
    assert.ok(typeof auth.requireApiKey === 'function');
    assert.ok(typeof auth.saveApiKey === 'function');
  });
});

describe('tar module', () => {
  it('creates tarball from directory', async () => {
    const { createTarball } = await import('../src/lib/tar.js');
    const { mkdtempSync, writeFileSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');

    const dir = mkdtempSync(join(tmpdir(), 'nom-test-'));
    writeFileSync(join(dir, 'index.html'), '<h1>test</h1>');

    const result = createTarball(dir);
    assert.ok(result.buffer.length > 0);
    assert.ok(result.size > 0);
    assert.ok(result.sizeFormatted);
  });
});
