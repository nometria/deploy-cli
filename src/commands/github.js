/**
 * nom github — Manage GitHub integration via Deno functions.
 *
 * Subcommands:
 *   connect  — Link GitHub account via OAuth in browser
 *   status   — Show GitHub connection status
 *   repos    — List connected repositories
 *   push     — Push changes to GitHub
 */
import { createServer } from 'node:http';
import { execSync } from 'node:child_process';
import { readConfig, updateConfig } from '../lib/config.js';
import { requireApiKey } from '../lib/auth.js';
import { apiRequest } from '../lib/api.js';

const CONNECT_TIMEOUT_MS = 300_000; // 5 minutes

export async function github(flags, positionals) {
  const sub = positionals[0];

  switch (sub) {
    case 'connect':
      return githubConnect(flags);
    case 'status':
      return githubStatus(flags);
    case 'repos':
      return githubRepos(flags);
    case 'push':
      return githubPush(flags);
    default:
      console.log(`
  Usage: nom github <command>

  Commands:
    connect   Link your GitHub account
    status    Show connection status
    repos     List connected repositories
    push      Push changes to GitHub
`);
  }
}

async function githubConnect(flags) {
  const apiKey = requireApiKey();
  console.log(`\n  Opening browser to connect GitHub...\n`);

  return new Promise((resolve, reject) => {
    let resolved = false;

    const server = createServer((req, res) => {
      if (resolved) { res.writeHead(410); res.end(); return; }
      if (!req.url) { res.writeHead(400); res.end(); return; }

      const url = new URL(req.url, `http://127.0.0.1`);

      if (url.pathname === '/callback') {
        const success = url.searchParams.get('success');
        const migrationId = url.searchParams.get('migration_id');

        res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' });
        if (success === 'true') {
          res.end(buildSuccessHtml());
          resolved = true;
          cleanup();

          // Update local config
          try {
            updateConfig(process.cwd(), {
              migration_id: migrationId,
              github_connected: true,
            });
          } catch { /* config update is best-effort */ }

          console.log(`  GitHub connected successfully!`);
          if (migrationId) console.log(`  Migration ID: ${migrationId}`);
          console.log();
          resolve();
        } else {
          res.end(buildErrorHtml('GitHub connection was not completed.'));
          resolved = true;
          cleanup();
          console.error('  GitHub connection failed.\n');
          process.exit(1);
        }
        return;
      }

      res.writeHead(404);
      res.end();
    });

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        cleanup();
        console.error('  Connection timed out. Try again.\n');
        process.exit(1);
      }
    }, CONNECT_TIMEOUT_MS);

    const cleanup = () => { clearTimeout(timeout); server.close(); };

    server.on('error', (err) => {
      if (!resolved) { resolved = true; cleanup(); reject(err); }
    });

    server.listen(0, '127.0.0.1', async () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        resolved = true;
        cleanup();
        reject(new Error('Failed to start local server'));
        return;
      }

      const port = addr.port;
      const redirectUri = `http://127.0.0.1:${port}/callback`;

      try {
        const config = readConfig();
        const appId = config.app_id || config.name;
        const result = await apiRequest('/cli/github-connect', {
          apiKey,
          body: { app_id: appId, redirect_uri: redirectUri },
        });

        const oauthUrl = result.oauth_url;
        if (!oauthUrl) {
          resolved = true;
          cleanup();
          console.error('  Failed to get OAuth URL from server.\n');
          process.exit(1);
          return;
        }

        console.log(`  If the browser doesn't open, visit:\n  ${oauthUrl}\n`);
        console.log(`  Waiting for GitHub authorization... (Ctrl+C to cancel)\n`);
        openBrowser(oauthUrl);
      } catch (err) {
        resolved = true;
        cleanup();
        console.error(`  Failed to initiate GitHub connection: ${err.message}\n`);
        process.exit(1);
      }
    });
  });
}

async function githubStatus(flags) {
  const apiKey = requireApiKey();
  const config = readConfig();
  const appId = config.app_id || config.name;

  const result = await apiRequest('/getUserGithubConnection', {
    apiKey,
    body: {},
  });

  if (flags.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`
  GitHub Connection
  Connected:  ${result.connected ? 'Yes' : 'No'}
  Username:   ${result.username || '—'}
  Repository: ${result.repository || '—'}
  Last Sync:  ${result.last_sync || '—'}
`);
}

async function githubRepos(flags) {
  const apiKey = requireApiKey();

  const config = readConfig();
  const migrationId = config.migration_id;
  if (!migrationId) {
    console.error('\n  No migration_id in nometria.json. Run nom deploy first.\n');
    process.exit(1);
  }
  const result = await apiRequest('/getGithubRepos', {
    apiKey,
    body: { migration_id: migrationId },
  });

  if (flags.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const repos = result.repos || [];
  if (!repos.length) {
    console.log('\n  No repositories found.\n');
    return;
  }

  console.log('\n  Repositories:\n');
  for (const repo of repos) {
    const visibility = repo.private ? 'private' : 'public';
    console.log(`  ${repo.full_name || repo.name}  (${visibility})`);
  }
  console.log();
}

async function githubPush(flags) {
  const apiKey = requireApiKey();
  const config = readConfig();
  const appId = config.app_id || config.name;
  const message = flags.message || flags.m || 'Update via nom';

  const migrationId = config.migration_id;
  const result = await apiRequest('/pushGithubChanges', {
    apiKey,
    body: { migration_id: migrationId, app_id: appId, commit_message: message },
  });

  if (flags.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (result.success) {
    console.log(`\n  Pushed to GitHub: ${result.commit_sha || ''}`);
    if (result.url) console.log(`  ${result.url}`);
    console.log();
  } else {
    console.error(`\n  Push failed: ${result.error || 'Unknown error'}\n`);
    process.exit(1);
  }
}

function openBrowser(url) {
  try {
    if (process.platform === 'darwin') execSync(`open "${url}"`);
    else if (process.platform === 'win32') execSync(`start "" "${url}"`);
    else execSync(`xdg-open "${url}"`);
  } catch {
    // Silently fail — user can copy the URL from the console
  }
}

function buildSuccessHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Nometria - GitHub Connected</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
           display: flex; align-items: center; justify-content: center;
           min-height: 100vh; background: #faf9f7; color: #1a1a1a; }
    .card { text-align: center; padding: 48px; max-width: 420px; }
    h1 { font-size: 20px; font-weight: 600; margin-bottom: 8px; }
    p { font-size: 14px; color: #666; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="card">
    <h1>GitHub Connected!</h1>
    <p>You can close this tab and return to your terminal.</p>
  </div>
</body>
</html>`;
}

function buildErrorHtml(message) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Nometria - Connection Failed</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
           display: flex; align-items: center; justify-content: center;
           min-height: 100vh; background: #faf9f7; color: #1a1a1a; }
    .card { text-align: center; padding: 48px; max-width: 420px; }
    h1 { font-size: 20px; font-weight: 600; margin-bottom: 8px; color: #dc2626; }
    p { font-size: 14px; color: #666; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Connection Failed</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;
}
