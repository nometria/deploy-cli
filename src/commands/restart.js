/**
 * nom restart - Restart an app paused due to inactivity (idle cost control).
 */
import { readConfig } from '../lib/config.js';
import { requireApiKey } from '../lib/auth.js';
import { apiRequest } from '../lib/api.js';
import { createSpinner } from '../lib/spinner.js';

const DASHBOARD_URL = 'https://nometria.com';

export async function restart(flags) {
  const apiKey = requireApiKey();
  const config = readConfig();
  const appId = config.app_id || config.name;

  if (!appId) {
    console.error('\n  No app_id in nometria.json. Deploy first: nom deploy\n');
    process.exit(1);
  }

  const spinner = createSpinner('Restarting app').start();
  try {
    const result = await apiRequest('/restartIdleStoppedApp', {
      apiKey,
      body: { app_id: appId },
    });

    spinner.succeed(result.message || 'Restart started');

    if (flags.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.log(`
  App:       ${config.name || appId}
  Action:    ${result.redeploy || 'restart'}
  Dashboard: ${DASHBOARD_URL}/AppDetails?app_id=${appId}
  Tip:       nom status - watch until running (usually 2–3 min)
`);
  } catch (err) {
    spinner.fail('Restart failed');
    if (err.status === 400) {
      console.error(`\n  ${err.message}`);
      console.error('  If the instance is already running, use: nom deploy\n');
    } else {
      console.error(`\n  ${err.message}\n`);
    }
    process.exit(1);
  }
}
