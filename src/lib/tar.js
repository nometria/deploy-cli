/**
 * Create tar.gz archive from project directory.
 * Uses system `tar` command (available on macOS/Linux/WSL).
 */
import { execSync } from 'node:child_process';
import { mkdtempSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const DEFAULT_EXCLUDES = [
  'node_modules',
  '.git',
  '.env',
  '.env.*',
  '.DS_Store',
  '*.log',
  '.next/cache',
  '.turbo',
  '.vercel',
  '.nometria',
  // Python
  '__pycache__',
  '*.pyc',
  '.venv',
  'venv',
  '.tox',
  '*.egg-info',
];

export function createTarball(dir, extraIgnore = []) {
  const tmpDir = mkdtempSync(join(tmpdir(), 'nom-'));
  const tarPath = join(tmpDir, 'code.tar.gz');

  const excludes = [...DEFAULT_EXCLUDES, ...extraIgnore]
    .map(p => `--exclude='${p}'`)
    .join(' ');

  try {
    execSync(`tar czf "${tarPath}" ${excludes} -C "${dir}" .`, {
      stdio: 'pipe',
      maxBuffer: 100 * 1024 * 1024, // 100MB
    });
  } catch (err) {
    throw new Error(`Failed to create archive: ${err.stderr?.toString() || err.message}`);
  }

  const stats = statSync(tarPath);
  const buffer = readFileSync(tarPath);

  return {
    path: tarPath,
    buffer,
    size: stats.size,
    sizeFormatted: formatBytes(stats.size),
  };
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
