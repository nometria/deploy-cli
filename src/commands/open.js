/**
 * nom open - Quick browser access to app, dashboard, logs, or docs.
 */
import { execSync } from 'node:child_process';
import { readConfig, configExists } from '../lib/config.js';
import { getApiKey } from '../lib/auth.js';
import { apiRequest } from '../lib/api.js';

const DASHBOARD_URL = 'https://nometria.com';
const DOCS_URL = 'https://docs.nometria.com';

export async function open(flags, positionals) {
  const target = positionals[0] || 'app';

  switch (target) {
    case 'dashboard':
    case 'dash': {
      const appId = getAppId();
      const url = appId
        ? `${DASHBOARD_URL}/AppDetails?app_id=${appId}`
        : DASHBOARD_URL;
      openUrl(url);
      console.log(`\n  Opened: ${url}\n`);
      return;
    }
    case 'logs': {
      const appId = getAppId();
      const url = appId
        ? `${DASHBOARD_URL}/AppDetails?app_id=${appId}#logs`
        : DASHBOARD_URL;
      openUrl(url);
      console.log(`\n  Opened: ${url}\n`);
      return;
    }
    case 'docs': {
      openUrl(DOCS_URL);
      console.log(`\n  Opened: ${DOCS_URL}\n`);
      return;
    }
    case 'app':
    default: {
      // Open the deployed app URL
      const apiKey = getApiKey();
      if (!apiKey || !configExists(process.cwd())) {
        console.error('\n  No deployed app found. Deploy first: nom deploy\n');
        process.exit(1);
      }
      const config = readConfig();
      const appId = config.app_id || config.name;
      try {
        const result = await apiRequest('/checkAwsStatus', {
          apiKey,
          body: { app_id: appId },
        });
        const data = result.data || result;
        const url = data.deployUrl || data.url || `https://${appId}.ownmy.app`;
        openUrl(url);
        console.log(`\n  Opened: ${url}\n`);
      } catch {
        const fallback = `https://${appId}.ownmy.app`;
        openUrl(fallback);
        console.log(`\n  Opened: ${fallback}\n`);
      }
      return;
    }
  }
}

function getAppId() {
  try {
    if (configExists(process.cwd())) {
      const config = readConfig();
      return config.app_id || config.name;
    }
  } catch { /* ignore */ }
  return null;
}

function openUrl(url) {
  const platform = process.platform;
  try {
    if (platform === 'darwin') {
      execSync(`open "${url}"`, { stdio: 'ignore' });
    } else if (platform === 'win32') {
      execSync(`start "" "${url}"`, { stdio: 'ignore' });
    } else {
      execSync(`xdg-open "${url}"`, { stdio: 'ignore' });
    }
  } catch {
    console.log(`\n  Could not open browser. Visit: ${url}\n`);
  }
}
