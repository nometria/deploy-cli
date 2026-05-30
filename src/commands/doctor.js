/**
 * nom doctor - Diagnose common issues and show system health.
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getApiKey } from '../lib/auth.js';
import { apiRequest } from '../lib/api.js';
import { configExists, readConfig } from '../lib/config.js';

export async function doctor(flags) {
  console.log('\n  nom doctor - System health check\n');

  const checks = [];

  // 1. Auth check
  const apiKey = getApiKey();
  if (apiKey) {
    try {
      const auth = await apiRequest('/cli/auth', { body: { api_key: apiKey } });
      checks.push({ name: 'Auth', status: 'OK', detail: auth.email || 'authenticated' });
    } catch {
      checks.push({ name: 'Auth', status: 'WARN', detail: 'Key found but invalid - run: nom login' });
    }
  } else {
    checks.push({ name: 'Auth', status: 'FAIL', detail: 'Not authenticated - run: nom login' });
  }

  // 2. Config check
  if (configExists(process.cwd())) {
    const config = readConfig();
    checks.push({ name: 'Config', status: 'OK', detail: 'nometria.json found' });
    checks.push({ name: 'Framework', status: 'OK', detail: config.framework || 'unknown' });
    checks.push({ name: 'Platform', status: 'OK', detail: `${config.platform || 'aws'} (${config.region || 'us-east-1'})` });
    checks.push({ name: 'Instance', status: 'OK', detail: config.instanceType || '4gb' });

    // 3. Build check
    if (config.build?.command) {
      try {
        execSync(config.build.command, {
          cwd: process.cwd(),
          stdio: 'pipe',
          env: { ...process.env, NODE_ENV: 'production' },
          timeout: 120000,
        });
        checks.push({ name: 'Build', status: 'OK', detail: config.build.command });
      } catch (err) {
        const errMsg = err.stderr?.toString().slice(0, 100) || err.message;
        checks.push({ name: 'Build', status: 'FAIL', detail: errMsg });
      }
    } else {
      checks.push({ name: 'Build', status: 'SKIP', detail: 'No build command configured' });
    }

    // 4. Remote status check
    if (apiKey && config.app_id) {
      try {
        const result = await apiRequest('/checkAwsStatus', {
          apiKey,
          body: { app_id: config.app_id },
        });
        const data = result.data || result;
        const state = data.instanceState || data.deploymentStatus || result.status || 'unknown';
        checks.push({ name: 'Instance', status: state === 'running' ? 'OK' : 'WARN', detail: `${state} (${config.instanceType || '4gb'})` });
        if (data.ipAddress) {
          checks.push({ name: 'IP', status: 'OK', detail: data.ipAddress });
        }
      } catch {
        checks.push({ name: 'Instance', status: 'WARN', detail: 'Could not reach API' });
      }
    }
  } else {
    checks.push({ name: 'Config', status: 'WARN', detail: 'No nometria.json - run: nom init' });
  }

  // 5. Local tool checks
  checks.push(checkCommand('Node', 'node --version'));
  checks.push(checkCommand('npm', 'npm --version'));
  checks.push(checkCommand('Docker', 'docker --version'));
  checks.push(checkCommand('Git', 'git --version'));

  // 6. Disk space
  try {
    const df = execSync('df -h .', { encoding: 'utf8', stdio: 'pipe' }).split('\n')[1];
    const parts = df.trim().split(/\s+/);
    const available = parts[3];
    checks.push({ name: 'Disk', status: 'OK', detail: `${available} available` });
  } catch {
    checks.push({ name: 'Disk', status: 'SKIP', detail: 'Could not check' });
  }

  // Print results
  for (const check of checks) {
    const icon = check.status === 'OK' ? 'OK' : check.status === 'WARN' ? 'WARN' : check.status === 'FAIL' ? 'FAIL' : 'SKIP';
    const pad = check.name.padEnd(14);
    console.log(`  ${icon.padEnd(6)} ${pad} ${check.detail}`);
  }
  console.log();

  const failures = checks.filter(c => c.status === 'FAIL');
  if (failures.length > 0) {
    console.log(`  ${failures.length} issue(s) found. Fix the FAIL items above.\n`);
  } else {
    console.log('  All checks passed. Ready to deploy.\n');
  }
}

function checkCommand(name, cmd) {
  try {
    const version = execSync(cmd, { encoding: 'utf8', stdio: 'pipe' }).trim();
    // Extract just the version number
    const match = version.match(/v?(\d+\.\d+\.\d+)/);
    return { name, status: 'OK', detail: match ? match[0] : version.slice(0, 30) };
  } catch {
    return { name, status: 'WARN', detail: 'Not installed' };
  }
}
