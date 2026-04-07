/**
 * nom env — Manage environment variables via Deno functions.
 *
 * Subcommands:
 *   set KEY=VALUE [KEY=VALUE ...]   Set environment variables
 *   list                            List variable names
 *   delete KEY [KEY ...]            Delete variables
 *
 * Scope flags:
 *   --preview       Target preview/staging environment
 *   --production    Target production environment (default)
 */
import { readConfig } from '../lib/config.js';
import { requireApiKey } from '../lib/auth.js';
import { apiRequest } from '../lib/api.js';

function getScope(flags) {
  if (flags.preview) return 'preview';
  return 'production'; // default
}

export async function env(flags, positionals) {
  const sub = positionals[0];

  switch (sub) {
    case 'set':
      return envSet(flags, positionals.slice(1));
    case 'list':
      return envList(flags);
    case 'delete':
      return envDelete(flags, positionals.slice(1));
    case 'compare':
      return envCompare(flags);
    case 'validate':
      return envValidate(flags);
    default:
      console.log(`
  Usage: nom env <command> [options]

  Commands:
    set KEY=VALUE [...]   Set environment variables
    list                  List variable names
    delete KEY [...]      Delete variables
    compare               Compare preview vs production env vars
    validate              Check if required env vars are set

  Options:
    --preview             Target preview/staging environment
    --production          Target production environment (default)
`);
  }
}

const SECRET_PATTERNS = [
  /^sk[-_]/i, /^pk[-_]/i, /secret/i, /password/i, /token/i,
  /api[-_]?key/i, /private[-_]?key/i, /^ghp_/, /^gho_/, /^nometria_sk_/,
];

function looksLikeSecret(key, value) {
  if (SECRET_PATTERNS.some(p => p.test(key))) return true;
  if (value && value.length > 20 && /^[A-Za-z0-9+/=_-]+$/.test(value)) return true;
  return false;
}

async function envSet(flags, pairs) {
  const apiKey = requireApiKey();
  const config = readConfig();
  const appId = config.app_id || config.name;
  const scope = getScope(flags);

  if (!pairs.length) {
    console.error('\n  Usage: nom env set KEY=VALUE [KEY=VALUE ...] [--preview|--production]\n');
    process.exit(1);
  }

  const vars = {};
  for (const pair of pairs) {
    const eqIndex = pair.indexOf('=');
    if (eqIndex === -1) {
      console.error(`\n  Invalid format: "${pair}". Use KEY=VALUE.\n`);
      process.exit(1);
    }
    const key = pair.slice(0, eqIndex);
    const value = pair.slice(eqIndex + 1);

    // Warn about secrets
    if (looksLikeSecret(key, value)) {
      console.log(`  Warning: "${key}" looks like a secret. Make sure it's not in nometria.json or git.`);
    }
    vars[key] = value;
  }

  const result = await apiRequest('/cli/env', {
    apiKey,
    body: { api_key: apiKey, app_id: appId, action: 'set', vars, scope },
  });

  if (flags.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const keys = Object.keys(vars);
  console.log(`\n  Set ${keys.length} variable${keys.length === 1 ? '' : 's'} (${scope}): ${keys.join(', ')}\n`);
}

async function envList(flags) {
  const apiKey = requireApiKey();
  const config = readConfig();
  const appId = config.app_id || config.name;
  const scope = getScope(flags);

  const result = await apiRequest('/cli/env', {
    apiKey,
    body: { api_key: apiKey, app_id: appId, action: 'list', scope },
  });

  if (flags.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const vars = result.keys || result.vars || [];
  if (!vars.length) {
    console.log(`\n  No environment variables set (${scope}).\n`);
    return;
  }

  console.log(`\n  Environment variables (${scope}):\n`);
  for (const name of vars) {
    console.log(`  ${name}`);
  }
  console.log();
}

async function envDelete(flags, keys) {
  const apiKey = requireApiKey();
  const config = readConfig();
  const appId = config.app_id || config.name;
  const scope = getScope(flags);

  if (!keys.length) {
    console.error('\n  Usage: nom env delete KEY [KEY ...] [--preview|--production]\n');
    process.exit(1);
  }

  const result = await apiRequest('/cli/env', {
    apiKey,
    body: { api_key: apiKey, app_id: appId, action: 'delete', vars: keys, scope },
  });

  if (flags.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`\n  Deleted ${keys.length} variable${keys.length === 1 ? '' : 's'} (${scope}): ${keys.join(', ')}\n`);
}

async function envCompare(flags) {
  const apiKey = requireApiKey();
  const config = readConfig();
  const appId = config.app_id || config.name;

  const [prodResult, prevResult] = await Promise.all([
    apiRequest('/cli/env', { apiKey, body: { api_key: apiKey, app_id: appId, action: 'list', scope: 'production' } }),
    apiRequest('/cli/env', { apiKey, body: { api_key: apiKey, app_id: appId, action: 'list', scope: 'preview' } }),
  ]);

  if (flags.json) {
    console.log(JSON.stringify({ production: prodResult, preview: prevResult }, null, 2));
    return;
  }

  const prodVars = new Set(prodResult.keys || prodResult.vars || []);
  const prevVars = new Set(prevResult.keys || prevResult.vars || []);
  const allKeys = new Set([...prodVars, ...prevVars]);

  if (!allKeys.size) {
    console.log('\n  No environment variables set in either environment.\n');
    return;
  }

  console.log('\n  Environment variable comparison:\n');
  console.log('  Key                        Production  Preview');
  console.log('  ─────────────────────────  ──────────  ───────');
  for (const key of [...allKeys].sort()) {
    const inProd = prodVars.has(key) ? 'set' : '—';
    const inPrev = prevVars.has(key) ? 'set' : '—';
    const marker = inProd !== inPrev ? ' *' : '';
    console.log(`  ${key.padEnd(27)} ${inProd.padEnd(12)}${inPrev}${marker}`);
  }
  console.log('\n  * = different between environments\n');
}

async function envValidate(flags) {
  const apiKey = requireApiKey();
  const config = readConfig();
  const appId = config.app_id || config.name;
  const scope = getScope(flags);

  // Collect expected vars from local .env and nometria.json
  const { existsSync, readFileSync } = await import('node:fs');
  const { join } = await import('node:path');

  const expectedKeys = new Set();

  // From local .env
  const envPath = join(process.cwd(), '.env');
  if (existsSync(envPath)) {
    const lines = readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const match = line.match(/^([A-Z_][A-Z0-9_]*)=/);
      if (match) expectedKeys.add(match[1]);
    }
  }

  // From nometria.json env section
  if (config.env && typeof config.env === 'object') {
    for (const key of Object.keys(config.env)) {
      expectedKeys.add(key);
    }
  }

  if (!expectedKeys.size) {
    console.log('\n  No expected environment variables found in .env or nometria.json.\n');
    return;
  }

  // Get deployed vars
  const result = await apiRequest('/cli/env', {
    apiKey,
    body: { api_key: apiKey, app_id: appId, action: 'list', scope },
  });
  const deployedKeys = new Set(result.keys || result.vars || []);

  // Compare
  const missing = [...expectedKeys].filter(k => !deployedKeys.has(k));
  const extra = [...deployedKeys].filter(k => !expectedKeys.has(k));

  console.log(`\n  Environment validation (${scope}):\n`);
  console.log(`  Local vars:    ${expectedKeys.size}`);
  console.log(`  Deployed vars: ${deployedKeys.size}`);

  if (missing.length) {
    console.log(`\n  Missing on ${scope} (${missing.length}):`);
    for (const key of missing) {
      console.log(`    - ${key}`);
    }
  }

  if (extra.length) {
    console.log(`\n  Extra on ${scope} (not in local .env):`);
    for (const key of extra) {
      console.log(`    + ${key}`);
    }
  }

  if (!missing.length && !extra.length) {
    console.log('\n  All environment variables match.');
  }

  console.log();

  if (missing.length) {
    console.log(`  Fix: nom env set ${missing.map(k => `${k}=<value>`).join(' ')}\n`);
    process.exit(1);
  }
}
