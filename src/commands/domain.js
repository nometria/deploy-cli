/**
 * nom domain — Manage custom domains via Deno functions.
 *
 * Subcommands:
 *   add <domain>  — Add a custom domain to the app
 */
import { readConfig } from '../lib/config.js';
import { requireApiKey } from '../lib/auth.js';
import { apiRequest } from '../lib/api.js';

export async function domain(flags, positionals) {
  const sub = positionals[0];

  switch (sub) {
    case 'add':
      return domainAdd(flags, positionals);
    default:
      console.log(`
  Usage: nom domain <command>

  Commands:
    add <domain>   Add a custom domain (e.g. nom domain add example.com)
`);
  }
}

async function domainAdd(flags, positionals) {
  const apiKey = requireApiKey();
  const config = readConfig();
  const appId = config.app_id || config.name;

  const customDomain = positionals[1];
  if (!customDomain) {
    console.error('\n  Usage: nom domain add <domain>\n');
    process.exit(1);
  }

  const result = await apiRequest('/addCustomDomain', {
    apiKey,
    body: { app_id: appId, custom_domain: customDomain },
  });

  if (flags.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (result.success) {
    console.log(`\n  Domain "${customDomain}" added.`);
    if (result.cname) console.log(`  CNAME: ${result.cname}`);
    if (result.instructions) console.log(`  ${result.instructions}`);
    console.log();
  } else {
    console.error(`\n  Failed to add domain: ${result.error || 'Unknown error'}\n`);
    process.exit(1);
  }
}
