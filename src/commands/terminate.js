/**
 * nom terminate — Terminate (destroy) an instance via Deno functions.
 */
import { readConfig } from '../lib/config.js';
import { requireApiKey } from '../lib/auth.js';
import { apiRequest } from '../lib/api.js';
import { confirm } from '../lib/prompt.js';

export async function terminate(flags) {
  const apiKey = requireApiKey();
  const config = readConfig();
  const appId = config.app_id || config.name;

  if (!flags.yes && !flags.y) {
    const ok = await confirm(`Terminate instance "${appId}"? This cannot be undone.`, false);
    if (!ok) {
      console.log('\n  Aborted.\n');
      return;
    }
  }

  const result = await apiRequest('/updateInstanceState', {
    apiKey,
    body: { app_id: appId, instance_state: 'terminate' },
  });

  if (flags.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`\n  Instance terminated.\n`);
}
