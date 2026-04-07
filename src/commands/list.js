/**
 * nom list — List all your deployed apps.
 */
import { requireApiKey } from '../lib/auth.js';
import { apiRequest } from '../lib/api.js';
import { getCached, setCache } from '../lib/cache.js';

export async function list(flags) {
  const apiKey = requireApiKey();

  // Check cache first (1 minute TTL), skip with --no-cache
  const noCache = flags['no-cache'] || flags.noCache;
  if (!noCache) {
    const cached = getCached('list_apps');
    if (cached) {
      const migrations = cached.migrations || cached || [];
      printApps(migrations, flags);
      console.log('  (cached — use --no-cache to refresh)\n');
      return;
    }
  }

  const result = await apiRequest('/listUserMigrations', { apiKey, body: {} });
  const migrations = result.migrations || result || [];
  setCache('list_apps', result);

  printApps(migrations, flags);
}

function printApps(migrations, flags) {
  if (!migrations.length) {
    console.log('\n  No apps found. Deploy your first app: nom deploy\n');
    return;
  }

  console.log(`\n  Your apps (${migrations.length}):\n`);

  if (flags.json) {
    console.log(JSON.stringify(migrations, null, 2));
    return;
  }

  for (const m of migrations) {
    const status = m.delivery_type === 'hosting' ? (m.payment_status === 'paid' ? 'hosting' : 'unpaid') : m.delivery_type || 'download';
    const platform = m.platform || '—';
    const url = m.hosted_url || m.deploy_url || '—';
    console.log(`  ${m.app_name || m.app_id}`);
    console.log(`    Platform: ${platform}  Status: ${status}  URL: ${url}`);
    console.log();
  }
}
