/**
 * nom init — Create nometria.json config interactively
 */
import { writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, basename } from 'node:path';
import { detectFramework, detectPackageManager, detectServices, detectMonorepo } from '../lib/detect.js';
import { configExists, CONFIG_FILE, VALID_PLATFORMS } from '../lib/config.js';
import { ask, choose, confirm } from '../lib/prompt.js';

const REGIONS = {
  aws: ['us-east-1', 'eu-west-1', 'ap-south-1', 'af-south-1'],
  gcp: ['us-central1', 'europe-west1', 'asia-south1'],
  azure: ['eastus', 'westeurope', 'centralindia'],
  digitalocean: ['nyc1', 'ams3', 'blr1'],
  hetzner: ['fsn1', 'nbg1', 'hel1', 'ash'],
  vercel: ['auto'],
  render: ['auto'],
};

export async function init(flags) {
  const dir = process.cwd();

  if (configExists(dir) && !flags.yes) {
    const overwrite = await confirm('nometria.json already exists. Overwrite?', false);
    if (!overwrite) {
      console.log('  Cancelled.\n');
      return;
    }
  }

  console.log('\n  Setting up your project for deployment\n');

  // Detect monorepo
  const mono = detectMonorepo(dir);
  if (mono.isMonorepo && mono.packages.length > 0 && !flags.yes) {
    console.log(`  Monorepo detected (${mono.tool}). Deployable packages:`);
    for (let i = 0; i < mono.packages.length; i++) {
      console.log(`    ${i + 1}. ${mono.packages[i]}`);
    }
    console.log();
  }

  // Detect framework and services
  let detected = detectFramework(dir);
  const pkgManager = detectPackageManager(dir);
  const { services, docker_compose } = detectServices(dir);

  // If detection is uncertain, warn and let user override
  if (detected.uncertain && !flags.yes) {
    console.log(`  Could not confidently detect framework (defaulting to "static").`);
    const frameworks = ['static', 'vite', 'nextjs', 'remix', 'astro', 'sveltekit', 'nuxt', 'node'];
    const choice = await choose('What framework is this project?', frameworks, 0);
    if (choice !== 'static') {
      detected = detectFramework(dir); // re-detect won't help, set manually
      detected.framework = choice;
      detected.uncertain = false;
      if (['vite', 'astro', 'sveltekit'].includes(choice)) {
        detected.build = { command: 'npm run build', output: choice === 'sveltekit' ? 'build' : 'dist' };
      } else if (choice === 'nextjs') {
        detected.build = { command: 'npm run build', output: '.next' };
      } else if (choice === 'nuxt') {
        detected.build = { command: 'npm run build', output: '.output' };
      } else if (choice === 'remix') {
        detected.build = { command: 'npm run build', output: 'build' };
      }
    }
  }

  console.log(`  Detected: ${detected.framework} (${pkgManager})`);
  if (services.length > 0) {
    console.log(`  Services: ${services.map(s => `${s.name} (${s.type})`).join(', ')}`);
  }
  if (docker_compose) {
    console.log(`  Docker Compose: yes`);
  }
  console.log();

  // Project name
  const dirName = basename(dir).replace(/[^a-z0-9-]/gi, '-').toLowerCase();
  const name = flags.yes ? dirName : await ask('Project name', dirName);

  // Platform
  const platform = flags.yes ? 'aws' : await choose('Where do you want to deploy?', VALID_PLATFORMS, 0);

  // Region
  const regionOptions = REGIONS[platform] || ['us-east-1'];
  let region = regionOptions[0];
  if (!flags.yes && regionOptions.length > 1) {
    region = await choose('Region', regionOptions, 0);
  }

  // Instance type (only for VM-based providers)
  let instanceType = '4gb';
  const vmProviders = ['aws', 'gcp', 'azure', 'digitalocean', 'hetzner'];
  if (!flags.yes && vmProviders.includes(platform)) {
    instanceType = await choose('Instance size', ['2gb', '4gb', '8gb', '16gb'], 1);
  }

  // Build command
  const buildCmd = detected.build.command
    ? detected.build.command.replace('npm', pkgManager)
    : null;

  const config = {
    name,
    framework: detected.framework,
    platform,
    region,
    ...(vmProviders.includes(platform) ? { instanceType } : {}),
    build: {
      ...(buildCmd ? { command: buildCmd } : {}),
      output: detected.build.output,
    },
    env: {},
    ignore: [],
    ...(services.length > 0 ? { services } : {}),
    ...(docker_compose ? { docker_compose: true } : {}),
  };

  const configPath = join(dir, CONFIG_FILE);
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');

  console.log(`\n  Created ${CONFIG_FILE}`);

  // Validate build if a build command exists
  if (buildCmd && !flags.yes) {
    const shouldValidate = await confirm('Test the build command now?', true);
    if (shouldValidate) {
      console.log(`\n  Running: ${buildCmd}`);
      try {
        execSync(buildCmd, { cwd: dir, stdio: 'inherit', env: { ...process.env, NODE_ENV: 'production' } });
        console.log(`\n  Build passed.\n`);
      } catch {
        console.log(`\n  Build failed. Fix the errors above, then run: nom deploy`);
        console.log(`  Help: https://docs.nometria.com/deploy/overview\n`);
      }
    }
  }

  // Auto-generate AI tool configs
  const { setup } = await import('./setup.js');
  await setup({ yes: true });

  console.log(`  Next steps:`);
  console.log(`    1. Run  nom login    to authenticate`);
  console.log(`    2. Run  nom deploy   to deploy\n`);
}
