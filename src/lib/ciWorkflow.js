/**
 * Generate a GitHub Actions workflow that runs `nom deploy` on push.
 *
 * The workflow checks out the repo, installs the detected package manager,
 * runs the build (handled inside `nom deploy`), and deploys using a
 * NOMETRIA_API_KEY repo secret. Any `@env:` references in nometria.json are
 * surfaced as `env:` entries wired to `${{ secrets.* }}` so resolveEnv() finds
 * them at deploy time.
 *
 * Pure string generation, no YAML dependency — shared between the CLI and the
 * web tool so generated files match exactly.
 */
import { secretKeys } from './envFile.js';

const SETUP = {
  npm:  { cache: 'npm',  install: 'npm ci' },
  pnpm: { cache: 'pnpm', install: 'pnpm install --frozen-lockfile' },
  yarn: { cache: 'yarn', install: 'yarn install --frozen-lockfile' },
  bun:  { cache: null,   install: 'bun install' },
};

/**
 * @param {object} opts
 * @param {object} opts.config         parsed nometria.json
 * @param {string} [opts.packageManager='npm']
 * @param {string} [opts.branch='main']
 * @param {string} [opts.nodeVersion='20']
 * @param {boolean} [opts.preview=false]  also add a preview job on pull_request
 * @returns {string} workflow YAML
 */
export function generateWorkflow({
  config = {},
  packageManager = 'npm',
  branch = 'main',
  nodeVersion = '20',
  preview = false,
} = {}) {
  const pm = SETUP[packageManager] ? packageManager : 'npm';
  const setup = SETUP[pm];
  const secrets = secretKeys(config.env || {});

  const envBlock = secrets.length
    ? [
        '    env:',
        '      NOMETRIA_API_KEY: ${{ secrets.NOMETRIA_API_KEY }}',
        ...secrets.map((k) => `      ${k}: \${{ secrets.${k} }}`),
      ]
    : [
        '    env:',
        '      NOMETRIA_API_KEY: ${{ secrets.NOMETRIA_API_KEY }}',
      ];

  const lines = [];
  lines.push(`name: Deploy to Nometria`);
  lines.push('');
  lines.push('on:');
  lines.push('  push:');
  lines.push(`    branches: [${branch}]`);
  if (preview) {
    lines.push('  pull_request:');
    lines.push(`    branches: [${branch}]`);
  }
  lines.push('  workflow_dispatch:');
  lines.push('');
  lines.push('jobs:');
  lines.push('  deploy:');
  lines.push(`    name: Deploy ${config.name || 'app'}`);
  lines.push('    runs-on: ubuntu-latest');
  lines.push(...envBlock);
  lines.push('    steps:');
  lines.push('      - uses: actions/checkout@v4');
  lines.push('');
  if (pm === 'pnpm') {
    lines.push('      - uses: pnpm/action-setup@v4');
    lines.push('');
  }
  if (pm === 'bun') {
    lines.push('      - uses: oven-sh/setup-bun@v2');
    lines.push('');
    lines.push('      - run: bun install');
  } else {
    lines.push('      - uses: actions/setup-node@v4');
    lines.push('        with:');
    lines.push(`          node-version: '${nodeVersion}'`);
    if (setup.cache) lines.push(`          cache: '${setup.cache}'`);
    lines.push('');
    lines.push(`      - run: ${setup.install}`);
  }
  lines.push('');
  if (preview) {
    // On PRs deploy a staging preview; on the default branch deploy production.
    lines.push('      - name: Deploy preview');
    lines.push("        if: github.event_name == 'pull_request'");
    lines.push('        run: npx @nometria-ai/nom preview --yes');
    lines.push('');
    lines.push('      - name: Deploy production');
    lines.push("        if: github.event_name != 'pull_request'");
    lines.push('        run: npx @nometria-ai/nom deploy --yes');
  } else {
    lines.push('      - name: Deploy');
    lines.push('        run: npx @nometria-ai/nom deploy --yes');
  }
  lines.push('');
  return lines.join('\n');
}

/** Repo secrets the user must add for the generated workflow to run. */
export function requiredSecrets(config = {}) {
  return ['NOMETRIA_API_KEY', ...secretKeys(config.env || {})];
}

export const WORKFLOW_PATH = '.github/workflows/deploy.yml';
