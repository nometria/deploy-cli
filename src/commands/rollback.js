/**
 * nom rollback — Roll back to a previous deployment.
 */
import { requireApiKey } from '../lib/auth.js';
import { apiRequest } from '../lib/api.js';
import { readConfig } from '../lib/config.js';
import { createSpinner } from '../lib/spinner.js';
import { confirm } from '../lib/prompt.js';

export async function rollback(flags, positionals) {
  const apiKey = requireApiKey();
  const config = readConfig();
  const appId = config.app_id;

  if (!appId) {
    console.error('\n  No app_id in nometria.json. Deploy first: nom deploy\n');
    process.exit(1);
  }

  // Step 1: List recent deployments
  const spinner = createSpinner('Fetching deployment history').start();
  let deployments;
  try {
    const result = await apiRequest('/v1/deployments', {
      apiKey,
      body: { app_id: appId },
    });
    deployments = result.deployments || result.data?.deployments || [];
    spinner.succeed(`Found ${deployments.length} deployment(s)`);
  } catch (err) {
    spinner.fail('Failed to fetch deployment history');
    console.error(`\n  ${err.message}`);
    console.error(`  This app may not support rollback yet.`);
    console.error(`  Help: https://docs.nometria.com/deploy/overview\n`);
    process.exit(1);
  }

  if (deployments.length < 2) {
    console.log('\n  No previous deployments to roll back to.\n');
    return;
  }

  // Step 2: Show recent deployments
  console.log('\n  Recent deployments:\n');
  for (let i = 0; i < Math.min(deployments.length, 10); i++) {
    const d = deployments[i];
    const marker = i === 0 ? ' (current)' : '';
    const status = d.status || 'unknown';
    const date = d.created_at ? new Date(d.created_at).toLocaleString() : '—';
    console.log(`  ${i + 1}. ${d.id}  ${status}  ${date}${marker}`);
  }
  console.log();

  // Step 3: Determine target
  let targetId = positionals?.[0];
  if (!targetId) {
    // Default to the second deployment (previous)
    if (deployments.length >= 2) {
      targetId = deployments[1].id;
    }
  }

  if (!targetId) {
    console.error('\n  No deployment to roll back to.\n');
    process.exit(1);
  }

  // Step 4: Confirm
  if (!flags.yes) {
    const ok = await confirm(`Roll back to ${targetId}?`, false);
    if (!ok) {
      console.log('  Cancelled.\n');
      return;
    }
  }

  // Step 5: Execute rollback
  const rollbackSpinner = createSpinner('Rolling back').start();
  try {
    const result = await apiRequest(`/v1/deployments/${targetId}/rollback`, {
      apiKey,
      body: { app_id: appId },
    });
    rollbackSpinner.succeed('Rollback complete');
    console.log(`\n  Rolled back to: ${targetId}`);
    if (result.url) console.log(`  URL: ${result.url}`);
    console.log(`  Dashboard: https://nometria.com/AppDetails?app_id=${appId}\n`);
  } catch (err) {
    rollbackSpinner.fail('Rollback failed');
    console.error(`\n  ${err.message}`);
    console.error(`  Dashboard: https://nometria.com/AppDetails?app_id=${appId}`);
    console.error(`  Help: https://docs.nometria.com/deploy/overview\n`);
    process.exit(1);
  }
}
