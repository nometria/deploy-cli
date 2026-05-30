/**
 * nom status - Check deployment status via Deno functions.
 */
import { readConfig } from '../lib/config.js';
import { requireApiKey } from '../lib/auth.js';
import { apiRequest } from '../lib/api.js';

function parseNotes(notes) {
  if (!notes) return {};
  try {
    return typeof notes === 'string' ? JSON.parse(notes) : notes;
  } catch {
    return {};
  }
}

export async function status(flags) {
  const apiKey = requireApiKey();
  const config = readConfig();
  const appId = config.app_id || config.name;

  const result = await apiRequest('/checkAwsStatus', {
    apiKey,
    body: { app_id: appId },
  });

  let migrationNotes = {};
  try {
    const list = await apiRequest('/listUserMigrations', {
      apiKey,
      body: { app_id: appId },
    });
    const row = list.migrations?.[0];
    migrationNotes = parseNotes(row?.notes);
  } catch {
    /* non-fatal */
  }

  if (flags.json) {
    console.log(JSON.stringify({
      ...result,
      idle_stopped_at: migrationNotes.idle_stopped_at || null,
    }, null, 2));
    return;
  }

  const data = result.data || {};
  const deployStatus = data.deploymentStatus || data.instanceState || result.status || 'unknown';
  const isIdleStopped = Boolean(migrationNotes.idle_stopped_at)
    || deployStatus === 'stopped'
    || data.instanceState === 'stopped';

  console.log(`
  App:       ${config.name || appId}
  Status:    ${deployStatus}${isIdleStopped ? ' (paused - inactivity)' : ''}
  URL:       ${data.deployUrl || '-'}
  Platform:  ${config.platform}
  Region:    ${config.region}
  Instance:  ${data.instanceType || config.instanceType || '-'}
  IP:        ${data.ipAddress || '-'}
`);

  if (isIdleStopped) {
    console.log(`  This app was paused to save hosting cost after 7+ days without updates.`);
    console.log(`  Restart it with: nom restart`);
    console.log(`  Or redeploy:     nom deploy\n`);
  }
}
