/**
 * Auto-detect project framework and build settings.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';

const DETECTORS = [
  {
    framework: 'nextjs',
    files: ['next.config.js', 'next.config.mjs', 'next.config.ts'],
    build: { command: 'npm run build', output: '.next' },
  },
  {
    framework: 'remix',
    files: ['remix.config.js', 'remix.config.ts'],
    build: { command: 'npm run build', output: 'build' },
  },
  {
    framework: 'expo',
    files: ['app.json', 'app.config.js', 'app.config.ts'],
    build: { command: 'npx expo export --platform web', output: 'dist' },
    // Only match if expo dependency is present (app.json is too generic)
    requireDep: 'expo',
  },
  {
    framework: 'vite',
    files: ['vite.config.js', 'vite.config.ts', 'vite.config.mjs'],
    build: { command: 'npm run build', output: 'dist' },
  },
  {
    framework: 'static',
    files: ['index.html'],
    build: { command: null, output: '.' },
  },
];

export function detectFramework(dir = process.cwd()) {
  // Check package.json scripts for hints
  const pkgPath = join(dir, 'package.json');
  let pkg = null;
  if (existsSync(pkgPath)) {
    try {
      pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    } catch { /* ignore */ }
  }

  const deps = pkg ? { ...pkg.dependencies, ...pkg.devDependencies } : {};
  const hasBuildScript = !!pkg?.scripts?.build;

  // Check for framework config files
  for (const detector of DETECTORS) {
    // Skip detectors that require a specific dependency
    if (detector.requireDep && !deps[detector.requireDep]) continue;
    for (const file of detector.files) {
      if (existsSync(join(dir, file))) {
        const buildCmd = detector.build.command;
        return {
          framework: detector.framework,
          build: {
            // If build command is 'npm run build', verify the script actually exists
            command: (buildCmd === 'npm run build' && !hasBuildScript) ? null : buildCmd,
            output: detector.build.output,
          },
        };
      }
    }
  }

  // Check package.json dependencies
  if (pkg) {
    if (deps['next']) return { framework: 'nextjs', build: { command: hasBuildScript ? 'npm run build' : null, output: '.next' } };
    if (deps['@remix-run/node']) return { framework: 'remix', build: { command: hasBuildScript ? 'npm run build' : null, output: 'build' } };
    if (deps['expo']) return { framework: 'expo', build: { command: 'npx expo export --platform web', output: 'dist' } };
    if (deps['vite']) return { framework: 'vite', build: { command: hasBuildScript ? 'npm run build' : null, output: 'dist' } };
  }

  // Check for Hono
  if (pkg) {
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (deps['hono']) return { framework: 'hono', build: { command: null, output: '.' } };
  }

  // Check for Solid
  if (existsSync(join(dir, 'solid.config.js')) || existsSync(join(dir, 'solid.config.ts'))) {
    return { framework: 'solid', build: { command: 'npm run build', output: 'dist' } };
  }
  if (pkg) {
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (deps['solid-js'] && deps['solid-start']) return { framework: 'solid', build: { command: 'npm run build', output: 'dist' } };
  }

  // Check for Astro
  if (existsSync(join(dir, 'astro.config.mjs')) || existsSync(join(dir, 'astro.config.ts'))) {
    return { framework: 'astro', build: { command: 'npm run build', output: 'dist' } };
  }
  if (pkg) {
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (deps['astro']) return { framework: 'astro', build: { command: 'npm run build', output: 'dist' } };
  }

  // Check for SvelteKit
  if (existsSync(join(dir, 'svelte.config.js')) || existsSync(join(dir, 'svelte.config.ts'))) {
    return { framework: 'sveltekit', build: { command: 'npm run build', output: 'build' } };
  }
  if (pkg) {
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (deps['@sveltejs/kit']) return { framework: 'sveltekit', build: { command: 'npm run build', output: 'build' } };
  }

  // Check for Nuxt
  if (existsSync(join(dir, 'nuxt.config.ts')) || existsSync(join(dir, 'nuxt.config.js'))) {
    return { framework: 'nuxt', build: { command: 'npm run build', output: '.output' } };
  }
  if (pkg) {
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (deps['nuxt']) return { framework: 'nuxt', build: { command: 'npm run build', output: '.output' } };
  }

  // Check if it looks like a Node.js project
  if (pkg && (pkg.main || pkg.scripts?.start)) {
    return { framework: 'node', build: { command: null, output: '.' } };
  }

  // Check for Python projects
  const pythonFiles = ['requirements.txt', 'pyproject.toml', 'Pipfile', 'setup.py', 'manage.py'];
  if (pythonFiles.some(f => existsSync(join(dir, f)))) {
    return { framework: 'python', build: { command: null, output: '.' } };
  }

  // Flag as uncertain — let callers decide whether to prompt or default
  return { framework: 'static', build: { command: null, output: '.' }, uncertain: true };
}

export function detectPackageManager(dir = process.cwd()) {
  if (existsSync(join(dir, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(join(dir, 'yarn.lock'))) return 'yarn';
  if (existsSync(join(dir, 'bun.lockb'))) return 'bun';
  return 'npm';
}

// ── Frontend/backend indicator deps ────────────────────────────────────────
const FRONTEND_INDICATORS = new Set([
  'react', 'react-dom', 'vue', 'svelte', '@sveltejs/kit', 'next', 'nuxt',
  '@angular/core', 'vite', 'solid-js', 'astro', '@remix-run/react',
]);
const FRONTEND_CONFIG_FILES = [
  'vite.config.js', 'vite.config.ts', 'vite.config.mjs',
  'next.config.js', 'next.config.mjs', 'next.config.ts',
  'svelte.config.js', 'nuxt.config.ts', 'angular.json', 'astro.config.mjs',
];
const BACKEND_INDICATORS = new Set([
  'express', 'fastify', 'hono', 'koa', '@nestjs/core', '@hapi/hapi',
  'restify', 'polka', 'micro', 'moleculer',
]);

/**
 * Classify a directory as frontend, backend, or unknown based on its package.json
 * and config files.
 */
function classifyServiceDir(dir) {
  const pkgPath = join(dir, 'package.json');
  if (!existsSync(pkgPath)) return null;

  let pkg;
  try { pkg = JSON.parse(readFileSync(pkgPath, 'utf8')); } catch { return null; }

  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const depNames = Object.keys(deps);

  // Check for frontend config files
  const hasFrontendConfig = FRONTEND_CONFIG_FILES.some(f => existsSync(join(dir, f)));
  const hasFrontendDep = depNames.some(d => FRONTEND_INDICATORS.has(d));
  const hasBackendDep = depNames.some(d => BACKEND_INDICATORS.has(d));

  let type = 'unknown';
  if (hasFrontendConfig || (hasFrontendDep && !hasBackendDep)) {
    type = 'frontend';
  } else if (hasBackendDep || (pkg.scripts?.start && !hasFrontendDep)) {
    type = 'backend';
  }

  // Detect build command
  let build = null;
  if (pkg.scripts?.build) {
    const pm = detectPackageManager(dir);
    build = `${pm} run build`;
  }

  // Detect start command
  let start = null;
  if (pkg.scripts?.start) {
    const pm = detectPackageManager(dir);
    start = `${pm} run start`;
  }

  // Try to detect port from scripts.start or common env patterns
  let port = null;
  const startScript = pkg.scripts?.start || '';
  const portMatch = startScript.match(/(?:--port|PORT=|:)\s*(\d{4,5})/);
  if (portMatch) port = parseInt(portMatch[1], 10);

  return { type, build, start, port };
}

/**
 * Detect multi-service project structure.
 * Scans subdirs for package.json, classifies as frontend/backend,
 * and checks for docker-compose.yml.
 *
 * Returns { services: [...], docker_compose: boolean }
 * services is empty for single-root projects (existing flow handles those).
 */
export function detectServices(dir = process.cwd()) {
  const result = { services: [], docker_compose: false };

  // Check for docker-compose
  if (existsSync(join(dir, 'docker-compose.yml')) || existsSync(join(dir, 'docker-compose.yaml'))) {
    result.docker_compose = true;
  }

  // If root has package.json AND no subdirs with package.json → single-root project
  const hasRootPkg = existsSync(join(dir, 'package.json'));

  // Scan immediate subdirs for package.json
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return result; }

  const subdirServices = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

    const subdir = join(dir, entry.name);
    const info = classifyServiceDir(subdir);
    if (!info) continue;

    subdirServices.push({
      name: entry.name,
      path: entry.name,
      type: info.type,
      ...(info.build ? { build: info.build } : {}),
      ...(info.start ? { start: info.start } : {}),
      ...(info.port ? { port: info.port } : {}),
    });
  }

  // Only populate services for multi-folder projects
  if (subdirServices.length > 0) {
    // Sort: frontends first, then backends, then unknown
    const order = { frontend: 0, backend: 1, unknown: 2 };
    subdirServices.sort((a, b) => (order[a.type] ?? 2) - (order[b.type] ?? 2));
    result.services = subdirServices;
  }

  return result;
}

/**
 * Detect if the project is a monorepo.
 * Returns { isMonorepo: boolean, tool: string|null, packages: string[] }
 */
export function detectMonorepo(dir = process.cwd()) {
  const result = { isMonorepo: false, tool: null, packages: [] };

  // Check for monorepo config files
  if (existsSync(join(dir, 'turbo.json'))) {
    result.isMonorepo = true;
    result.tool = 'turborepo';
  } else if (existsSync(join(dir, 'nx.json'))) {
    result.isMonorepo = true;
    result.tool = 'nx';
  } else if (existsSync(join(dir, 'pnpm-workspace.yaml'))) {
    result.isMonorepo = true;
    result.tool = 'pnpm-workspaces';
  } else if (existsSync(join(dir, 'lerna.json'))) {
    result.isMonorepo = true;
    result.tool = 'lerna';
  }

  // Check package.json workspaces
  if (!result.isMonorepo) {
    const pkgPath = join(dir, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
        if (pkg.workspaces) {
          result.isMonorepo = true;
          result.tool = 'npm-workspaces';
        }
      } catch { /* ignore */ }
    }
  }

  if (!result.isMonorepo) return result;

  // Find deployable packages (those with package.json and a build or start script)
  const packagesDir = existsSync(join(dir, 'packages')) ? join(dir, 'packages') :
                      existsSync(join(dir, 'apps')) ? join(dir, 'apps') : null;

  if (packagesDir) {
    try {
      const entries = readdirSync(packagesDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
        const pkgJson = join(packagesDir, entry.name, 'package.json');
        if (existsSync(pkgJson)) {
          try {
            const pkg = JSON.parse(readFileSync(pkgJson, 'utf8'));
            if (pkg.scripts?.build || pkg.scripts?.start || pkg.scripts?.dev) {
              result.packages.push(entry.name);
            }
          } catch { /* skip */ }
        }
      }
    } catch { /* skip */ }
  }

  return result;
}

export function getProjectName(dir = process.cwd()) {
  const pkgPath = join(dir, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
      if (pkg.name) {
        // Strip scope and sanitize
        return pkg.name.replace(/^@[^/]+\//, '').replace(/[^a-z0-9-]/g, '-');
      }
    } catch { /* ignore */ }
  }
  // Use directory name
  return basename(dir).replace(/[^a-z0-9-]/gi, '-').toLowerCase();
}
