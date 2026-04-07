/**
 * nom upgrade — Upgrade instance size via Deno functions.
 */
import { readConfig } from '../lib/config.js';
import { requireApiKey } from '../lib/auth.js';
import { apiRequest } from '../lib/api.js';

const VALID_SIZES = ['2gb', '4gb', '8gb', '16gb'];

export async function upgrade(flags, positionals) {
  const apiKey = requireApiKey();
  const config = readConfig();
  const appId = config.app_id || config.name;

  const instanceType = positionals[0];
  if (!instanceType) {
    console.log(`
  Usage: nom upgrade <size>

  Sizes: ${VALID_SIZES.join(', ')}
`);
    process.exit(1);
  }

  const size = instanceType.toLowerCase();
  if (!VALID_SIZES.includes(size)) {
    console.error(`\n  Invalid size "${instanceType}". Must be one of: ${VALID_SIZES.join(', ')}\n`);
    process.exit(1);
  }

  const result = await apiRequest('/upgradeInstance', {
    apiKey,
    body: { app_id: appId, instance_type: size },
  });

  if (flags.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (result.success) {
    console.log(`\n  Upgraded to ${size}`);
    if (result.message) console.log(`  ${result.message}`);
    console.log();
  } else {
    console.error(`\n  Upgrade failed: ${result.error || 'Unknown error'}\n`);
    process.exit(1);
  }
}
