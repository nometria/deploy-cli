/**
 * nom status — Check deployment status via Deno functions.
 */
import { readConfig } from '../lib/config.js';
import { requireApiKey } from '../lib/auth.js';
import { apiRequest } from '../lib/api.js';

export async function status(flags) {
  const apiKey = requireApiKey();
  const config = readConfig();
  const appId = config.app_id || config.name;

  const result = await apiRequest('/checkAwsStatus', {
    apiKey,
    body: { app_id: appId },
  });

  if (flags.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const data = result.data || {};
  console.log(`
  App:       ${config.name || appId}
  Status:    ${data.deploymentStatus || data.instanceState || result.status || 'unknown'}
  URL:       ${data.deployUrl || '—'}
  Platform:  ${config.platform}
  Region:    ${config.region}
  Instance:  ${data.instanceType || config.instanceType || '—'}
  IP:        ${data.ipAddress || '—'}
`);
}
