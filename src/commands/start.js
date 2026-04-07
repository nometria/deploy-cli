/**
 * nom start — Start a stopped instance via Deno functions.
 */
import { readConfig } from '../lib/config.js';
import { requireApiKey } from '../lib/auth.js';
import { apiRequest } from '../lib/api.js';

export async function start(flags) {
  const apiKey = requireApiKey();
  const config = readConfig();
  const appId = config.app_id || config.name;

  const result = await apiRequest('/updateInstanceState', {
    apiKey,
    body: { app_id: appId, instance_state: 'start' },
  });

  if (flags.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`\n  Instance starting...`);
  if (result.url) console.log(`  URL: ${result.url}`);
  console.log();
}
