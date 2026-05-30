/**
 * Interactive duplicate + idle-stop gates for nom deploy/preview.
 */
import { apiRequest } from './api.js';
import { choose, confirm } from './prompt.js';
import { updateConfig } from './config.js';

export async function resolveDuplicateDeployIntent({
  apiKey,
  tarball,
  uploadFileName,
  config,
  flags,
}) {
  if (config.app_id) {
    return { app_id: config.app_id };
  }

  const check = await apiRequest('/checkExistingMigration', {
    apiKey,
    body: {
      upload_file_name: uploadFileName,
      upload_file_size: tarball.buffer.byteLength,
      exclude_migration_id: config.migration_id,
      github_repo_url: config.github_repo_url,
    },
  });

  if (!check.exists || !check.match) {
    return {};
  }

  const match = check.match;
  const label = check.match_type === 'github'
    ? 'GitHub repository'
    : 'upload file';

  if (flags.yes) {
    console.log(`\n  Existing app found for this ${label}: ${match.app_name} (${match.app_id})`);
    console.log('  Updating existing app (--yes).\n');
    try {
      updateConfig(process.cwd(), { app_id: match.app_id, migration_id: match.id || config.migration_id });
    } catch { /* non-fatal */ }
    return { use_existing_app_id: match.app_id, app_id: match.app_id };
  }

  console.log(`\n  An app already exists for this ${label} on your account:`);
  console.log(`    ${match.app_name} (${match.app_id})`);
  if (match.idle_stopped_at) {
    console.log('    Status: paused due to inactivity');
  }
  console.log();

  const choice = await choose('What would you like to do?', [
    `Update existing app (${match.app_id})`,
    'Create new app anyway',
  ], 0);

  if (choice.startsWith('Update existing')) {
    try {
      updateConfig(process.cwd(), { app_id: match.app_id, migration_id: match.id || config.migration_id });
    } catch { /* non-fatal */ }
    return { use_existing_app_id: match.app_id, app_id: match.app_id };
  }

  return { force_new: true };
}

export async function resolveIdleStoppedDeployIntent({ apiKey, config, flags }) {
  const appId = config.app_id;
  if (!appId) return {};

  let status;
  try {
    status = await apiRequest('/checkAwsStatus', { apiKey, body: { app_id: appId } });
  } catch {
    return {};
  }

  const data = status.data || status;
  const deployStatus = data.deploymentStatus || data.instanceState || status.status;
  const isStopped = deployStatus === 'stopped' || data.instanceState === 'stopped';
  if (!isStopped) return {};

  if (flags.yes) {
    console.log('\n  App is paused due to inactivity - restarting as part of deploy.\n');
    return { restart_if_stopped: true };
  }

  const restart = await confirm(
    'This app is paused due to inactivity. Restart and deploy now?',
    true,
  );
  if (!restart) {
    console.log('\n  Deploy cancelled. Restart manually with: nom restart\n');
    process.exit(0);
  }
  return { restart_if_stopped: true };
}

export async function handleDeployApiError(err) {
  if (err.status !== 409 || !err.data) return false;

  const code = err.data.code;
  if (code === 'ERR_IDLE_STOPPED') {
    console.error(`\n  ${err.message}`);
    if (err.data.cli_hint) console.error(`  ${err.data.cli_hint}`);
    console.error();
    process.exit(1);
  }

  if (code === 'ERR_DUPLICATE_MIGRATION') {
    console.error(`\n  ${err.message}`);
    if (err.data.match?.app_id) {
      console.error(`  Existing app: ${err.data.match.app_name} (${err.data.match.app_id})`);
    }
    console.error('  Re-run interactively (without --yes) to choose update vs create new.\n');
    process.exit(1);
  }

  return false;
}
