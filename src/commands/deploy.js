/**
 * nom deploy — Build, upload, and deploy to production.
 * All calls go through Deno functions at app.nometria.com.
 */
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { readConfig, resolveEnv, updateConfig, configExists } from '../lib/config.js';
import { detectServices } from '../lib/detect.js';
import { getApiKey } from '../lib/auth.js';
import { apiRequest, uploadFile } from '../lib/api.js';
import { createTarball } from '../lib/tar.js';
import { createSpinner } from '../lib/spinner.js';
import { confirm } from '../lib/prompt.js';
import { trackCommand } from '../lib/telemetry.js';
import { login } from './login.js';
import { init } from './init.js';

const INSTANCE_COSTS = {
  '2gb': { monthly: '$39', type: 't4g.small' },
  '4gb': { monthly: '$49', type: 't4g.medium' },
  '8gb': { monthly: '$79', type: 't4g.large' },
  '16gb': { monthly: '$129', type: 't4g.xlarge' },
};

const HELP_URL = 'https://docs.nometria.com';
const DASHBOARD_URL = 'https://nometria.com';

export async function deploy(flags) {
  // Auto-login if not authenticated
  let apiKey = getApiKey();
  if (!apiKey) {
    console.log('\n  No credentials found. Signing in first...\n');
    await login(flags);
    apiKey = getApiKey();
    if (!apiKey) {
      const err = new Error('Not authenticated');
      err.code = 'ERR_AUTH';
      throw err;
    }
  }

  // Auto-init if no nometria.json
  if (!configExists(process.cwd())) {
    console.log('  No nometria.json found. Setting up project...\n');
    await init({ yes: true });
  }

  const config = readConfig();
  const envVars = resolveEnv(config.env);
  const appName = config.name || config.app_id;
  const isResync = !!config.app_id;
  const isDryRun = flags['dry-run'] || flags.dryRun;

  const telemetry = trackCommand('deploy', { framework: config.framework, platform: config.platform, isResync });

  if (isDryRun) {
    return dryRun(config, apiKey, appName);
  }

  // Auto-detect services if not in config (so nometria.json includes it in tarball)
  if (!config.services) {
    const { services, docker_compose } = detectServices(process.cwd());
    if (services.length > 0 || docker_compose) {
      const updates = {};
      if (services.length > 0) updates.services = services;
      if (docker_compose) updates.docker_compose = true;
      try { updateConfig(process.cwd(), updates); Object.assign(config, updates); } catch { /* non-fatal */ }
    }
  }

  const instanceSize = config.instanceType || '4gb';
  const cost = INSTANCE_COSTS[instanceSize];

  if (isResync) {
    console.log(`\n  Resyncing ${appName} on ${config.platform} (${config.region})\n`);
  } else {
    console.log(`\n  Deploying ${appName} to ${config.platform} (${config.region})`);
    if (cost) {
      console.log(`  Instance: ${instanceSize} (${cost.type}) — ${cost.monthly}/mo`);
    }
    console.log();
  }

  const totalSteps = config.build?.command ? 5 : 4;
  let step = 0;
  const stepLabel = (label) => `[${++step}/${totalSteps}] ${label}`;

  // Step 1: Build
  if (config.build?.command) {
    const spinner = createSpinner(stepLabel('Building')).start();
    try {
      execSync(config.build.command, {
        cwd: process.cwd(),
        stdio: 'pipe',
        env: { ...process.env, NODE_ENV: 'production' },
      });
      spinner.succeed('Built successfully');
    } catch (err) {
      spinner.fail('Build failed');
      console.error(`\n${err.stderr?.toString() || err.message}\n`);
      process.exit(1);
    }
  }

  // Step 2: Create archive
  const archiveSpinner = createSpinner(stepLabel('Creating archive')).start();
  let tarball;
  try {
    tarball = createTarball(process.cwd(), config.ignore);
    archiveSpinner.succeed(`Archive created (${tarball.sizeFormatted})`);
  } catch (err) {
    archiveSpinner.fail('Failed to create archive');
    throw err;
  }

  // Step 3: Upload
  const uploadSpinner = createSpinner(stepLabel('Uploading')).start();
  let uploadResult;
  try {
    uploadResult = await uploadFile(apiKey, tarball.buffer, `${appName}.tar.gz`);
    uploadSpinner.succeed(`Uploaded (${tarball.sizeFormatted})`);
  } catch (err) {
    uploadSpinner.fail('Upload failed');
    throw err;
  }

  // Step 4: Trigger deploy
  const deploySpinner = createSpinner(stepLabel(isResync ? 'Resyncing' : 'Deploying')).start();
  let deployResult;
  try {
    deployResult = await apiRequest('/cli/deploy', {
      apiKey,
      body: {
        app_name: appName,
        upload_url: uploadResult.upload_url,
        platform: config.platform,
        region: config.region,
        instance_type: config.instanceType || '4gb',
        env_vars: envVars,
        framework: config.framework,
        ...(config.app_id ? { app_id: config.app_id } : {}),
      },
    });
  } catch (err) {
    deploySpinner.fail(isResync ? 'Resync failed' : 'Deploy request failed');
    throw err;
  }

  // Step 5: Poll for status
  const deployId = deployResult.deploy_id || appName;
  const dashboardUrl = `${DASHBOARD_URL}/AppDetails?app_id=${deployId}`;
  console.log(`\n  Dashboard:  ${dashboardUrl}`);
  console.log(`  You can close this terminal — check the dashboard for progress.\n`);

  let finalStatus;
  let consecutiveErrors = 0;
  const pollStart = Date.now();
  const POLL_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
  while (true) {
    await sleep(3000);
    try {
      const statusResult = await apiRequest('/checkAwsStatus', {
        apiKey,
        body: { app_id: deployId },
      });
      consecutiveErrors = 0; // reset on success

      // statusResult may be unwrapped (top-level fields) or nested under .data
      const deployStatus = statusResult.deploymentStatus || statusResult.data?.deploymentStatus;
      const instanceState = statusResult.instanceState || statusResult.data?.instanceState;
      const topStatus = statusResult.status;
      const st = deployStatus || instanceState || topStatus || 'unknown';
      deploySpinner.update(`${isResync ? 'Resyncing' : 'Deploying'} — ${st}`);

      const isDone = deployStatus === 'completed' || deployStatus === 'running';
      if (isDone) {
        finalStatus = statusResult;
        deploySpinner.succeed(isResync ? 'Resynced successfully' : 'Deployed successfully');
        telemetry.success({ instanceType: instanceSize });
        break;
      }
      if (deployStatus === 'failed' || st === 'failed') {
        deploySpinner.fail(`${isResync ? 'Resync' : 'Deploy'} failed: ${statusResult.errorMessage || statusResult.data?.errorMessage || 'unknown error'}`);
        console.error(`\n  View logs: nom logs`);
        console.error(`  Dashboard: ${dashboardUrl}`);
        console.error(`  Help: ${HELP_URL}/deploy/overview\n`);
        process.exit(1);
      }

      // Timeout: if instance is running but status stuck at deploying, show URL and exit gracefully
      if (Date.now() - pollStart > POLL_TIMEOUT_MS && instanceState === 'running') {
        finalStatus = statusResult;
        deploySpinner.succeed('Deploy in progress — check dashboard for final status');
        break;
      }
    } catch (err) {
      consecutiveErrors++;
      if (consecutiveErrors >= 5) {
        deploySpinner.fail(`Lost connection while polling (${consecutiveErrors} consecutive errors)`);
        console.error(`\n  Last error: ${err.message}`);
        console.error(`  Check status manually: nom status`);
        console.error(`  Dashboard: ${dashboardUrl}`);
        console.error(`  Help: ${HELP_URL}/deploy/overview\n`);
        process.exit(1);
      }
      deploySpinner.update(`${isResync ? 'Resyncing' : 'Deploying'} — retrying (${consecutiveErrors}/5)...`);
    }
  }
  if (!finalStatus) {
    deploySpinner.fail('Timed out waiting for deployment');
    console.error(`\n  The deploy may still be in progress. Check status:`);
    console.error(`  nom status`);
    console.error(`  Dashboard: ${dashboardUrl}\n`);
    process.exit(1);
  }

  // Step 6: Write app_id and migration_id back to nometria.json
  const updates = {};
  if (!config.app_id && deployId) updates.app_id = deployId;
  if (deployResult.migration_id && !config.migration_id) updates.migration_id = deployResult.migration_id;
  if (Object.keys(updates).length > 0) {
    try { updateConfig(process.cwd(), updates); } catch { /* non-fatal */ }
  }

  // Step 7: Print result
  const url = finalStatus.deployUrl || finalStatus.data?.deployUrl || finalStatus.url || `https://${deployId}.ownmy.app`;
  const instanceInfo = finalStatus.instanceType || finalStatus.data?.instanceType || instanceSize;
  console.log(`
  ${isResync ? 'Resynced' : 'Deployed'} successfully!

  URL:        ${url}
  Instance:   ${instanceInfo}${cost ? ` (${cost.monthly}/mo)` : ''}
  Dashboard:  ${dashboardUrl}
`);

  // First deploy — show next steps
  if (!isResync) {
    console.log(`  Next steps:`);
    console.log(`    nom github connect     Connect GitHub for auto-deploy`);
    console.log(`    nom domain add <url>   Add a custom domain`);
    console.log(`    nom env set KEY=VAL    Set environment variables`);
    console.log(`    nom logs -f            Watch live logs`);
    console.log(`    nom scan               Run security scan`);
    console.log();
  }

  // Step 8: Auto-detect git repo and offer GitHub connection
  if (!flags.yes) {
    const hasGit = existsSync(join(process.cwd(), '.git'));
    if (hasGit) {
      try {
        const ghStatus = await apiRequest('/getUserGithubConnection', {
          apiKey,
          body: {},
        });
        if (!ghStatus.connected) {
          const connectGh = await confirm('This project is a git repo. Connect GitHub for auto-deploy?');
          if (connectGh) {
            console.log('  Run: nom github connect\n');
          }
        }
      } catch { /* non-fatal — github status check failed */ }
    }
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function dryRun(config, apiKey, appName) {
  const instanceSize = config.instanceType || '4gb';
  const cost = INSTANCE_COSTS[instanceSize];

  console.log(`\n  Dry run for: ${appName}`);
  console.log(`  ─────────────────────────────────\n`);

  // 1. Config check
  console.log(`  Config:     nometria.json`);
  console.log(`  Framework:  ${config.framework || 'unknown'}`);
  console.log(`  Platform:   ${config.platform || 'aws'} (${config.region || 'us-east-1'})`);
  console.log(`  Instance:   ${instanceSize}${cost ? ` (${cost.type}) — ${cost.monthly}/mo` : ''}`);
  console.log(`  App ID:     ${config.app_id || '(new — will be created)'}`);
  console.log();

  // 2. Auth check
  console.log(`  Checking auth...`);
  try {
    const authResult = await apiRequest('/cli/auth', { body: { api_key: apiKey } });
    console.log(`  Auth:       OK (${authResult.email || 'authenticated'})`);
  } catch (err) {
    console.log(`  Auth:       FAILED — ${err.message}`);
    console.log(`              Get a key: https://nometria.com/settings/api-keys\n`);
    process.exit(1);
  }

  // 3. Build check
  if (config.build?.command) {
    console.log(`  Testing build: ${config.build.command}`);
    try {
      execSync(config.build.command, {
        cwd: process.cwd(),
        stdio: 'pipe',
        env: { ...process.env, NODE_ENV: 'production' },
      });
      console.log(`  Build:      PASSED`);
    } catch (err) {
      console.log(`  Build:      FAILED`);
      console.error(`\n${err.stderr?.toString().slice(0, 500) || err.message}\n`);
      process.exit(1);
    }
  } else {
    console.log(`  Build:      (no build command)`);
  }

  // 4. Archive size estimate
  try {
    const tarball = createTarball(process.cwd(), config.ignore);
    console.log(`  Archive:    ${tarball.sizeFormatted}`);
  } catch {
    console.log(`  Archive:    (could not estimate)`);
  }

  // 5. Status check
  if (config.app_id) {
    try {
      const status = await apiRequest('/checkAwsStatus', { apiKey, body: { app_id: config.app_id } });
      const state = status.instanceState || status.data?.instanceState || status.status || 'unknown';
      console.log(`  Instance:   ${state}`);
    } catch {
      console.log(`  Instance:   (could not check)`);
    }
  }

  console.log(`\n  Dry run complete. Ready to deploy.`);
  console.log(`  Run: nom deploy\n`);
}
