/**
 * nom login — Authenticate via browser (default) or API key paste.
 *
 * Default flow (browser):
 *   1. Start a local HTTP server on a random port
 *   2. Open nometria.com/extension/login?redirect_uri=http://127.0.0.1:{port}/callback
 *   3. User signs in with Google/GitHub/email in the browser
 *   4. Browser redirects back with Supabase JWT token
 *   5. CLI calls /cli/create-api-key with that JWT to generate a persistent API key
 *   6. Saves the API key to ~/.nometria/credentials.json
 *
 * Fallback (--api-key):
 *   Paste an existing API key manually.
 */
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { execSync } from 'node:child_process';
import { saveApiKey } from '../lib/auth.js';
import { apiRequest, getBaseUrl } from '../lib/api.js';
import { ask } from '../lib/prompt.js';

const LOGIN_TIMEOUT_MS = 300_000; // 5 minutes
const MAX_BODY_BYTES = 8192;

export async function login(flags) {
  // Manual API key flow
  if (flags['api-key'] || flags.token) {
    return loginWithApiKey();
  }

  // Browser-based login (default)
  return loginWithBrowser();
}

async function loginWithBrowser() {
  console.log(`\n  Opening browser to sign in...\n`);

  const state = randomBytes(16).toString('hex');

  return new Promise((resolve, reject) => {
    let resolved = false;

    const server = createServer((req, res) => {
      if (resolved) { res.writeHead(410); res.end(); return; }
      if (!req.url) { res.writeHead(400); res.end(); return; }

      // Serve the callback page that extracts hash params
      if (req.url.startsWith('/callback')) {
        res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' });
        res.end(buildCallbackHtml(state));
        return;
      }

      // Receive the token POSTed by the callback page
      if (req.url === '/token' && req.method === 'POST') {
        let body = '';
        let bytes = 0;

        req.on('data', (chunk) => {
          bytes += chunk.length;
          if (bytes > MAX_BODY_BYTES) { res.writeHead(413); res.end(); req.destroy(); return; }
          body += chunk.toString();
        });

        req.on('end', async () => {
          if (resolved) return;
          try {
            const data = JSON.parse(body);
            if (data.state !== state) { res.writeHead(403); res.end('Invalid state'); return; }
            if (!data.access_token) { res.writeHead(400); res.end('Missing token'); return; }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));

            resolved = true;
            cleanup();

            // Exchange JWT for persistent API key
            await exchangeTokenForApiKey(data.access_token, data.email);
            resolve();
          } catch (err) {
            res.writeHead(400);
            res.end('Invalid JSON');
          }
        });
        return;
      }

      res.writeHead(404);
      res.end();
    });

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        cleanup();
        console.error('  Login timed out. Try again or use: nom login --api-key\n');
        process.exit(1);
      }
    }, LOGIN_TIMEOUT_MS);

    const cleanup = () => { clearTimeout(timeout); server.close(); };

    server.on('error', (err) => {
      if (!resolved) { resolved = true; cleanup(); reject(err); }
    });

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        resolved = true;
        cleanup();
        reject(new Error('Failed to start auth server'));
        return;
      }

      const port = addr.port;
      const redirectUri = `http://127.0.0.1:${port}/callback`;
      const appUrl = process.env.NOMETRIA_APP_URL || 'https://nometria.com';
      const loginUrl = `${appUrl}/extension/login?redirect_uri=${encodeURIComponent(redirectUri)}`;

      console.log(`  If the browser doesn't open, visit:\n  ${loginUrl}\n`);
      console.log(`  Waiting for sign-in... (Ctrl+C to cancel)\n`);

      // Open browser
      openBrowser(loginUrl);
    });
  });
}

async function exchangeTokenForApiKey(jwtToken, email) {
  process.stdout.write('  Creating API key...');

  try {
    const baseUrl = getBaseUrl();
    const res = await fetch(`${baseUrl}/cli/create-api-key`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwtToken}`,
      },
      body: JSON.stringify({ label: `CLI Login (${new Date().toLocaleDateString()})` }),
    });

    const raw = await res.json();
    // server.js wraps all responses in { data: ... } — unwrap
    const data = raw?.data !== undefined ? raw.data : raw;

    if (!res.ok || !data.success) {
      console.log(' failed.');
      console.error(`  ${data.error || 'Could not create API key'}`);
      console.error('  Try: nom login --api-key\n');
      process.exit(1);
    }

    const savedPath = saveApiKey(data.api_key);
    console.log(` done!`);
    console.log(`\n  Authenticated as ${data.email || email || 'unknown'}`);
    console.log(`  Credentials saved to ${savedPath}\n`);
  } catch (err) {
    console.log(' failed.');
    console.error(`  ${err.message}`);
    console.error('  Try: nom login --api-key\n');
    process.exit(1);
  }
}

async function loginWithApiKey() {
  console.log(`
  Log in with API key

  1. Go to https://nometria.com/settings/api-keys
  2. Generate an API key
  3. Paste it below
`);

  const key = await ask('API key');
  if (!key) { console.error('  No key provided.'); process.exit(1); }

  process.stdout.write('  Verifying...');
  try {
    const result = await apiRequest('/cli/auth', { body: { api_key: key } });
    if (result.success) {
      const savedPath = saveApiKey(key);
      console.log(` authenticated as ${result.email}`);
      console.log(`  Credentials saved to ${savedPath}\n`);
    } else {
      console.log(' invalid key.');
      process.exit(1);
    }
  } catch (err) {
    if (err.status === 401) {
      console.log(' invalid key.');
      console.error('  Check your key and try again.\n');
      process.exit(1);
    }
    throw err;
  }
}

function openBrowser(url) {
  const platform = process.platform;
  try {
    if (platform === 'darwin') execSync(`open "${url}"`);
    else if (platform === 'win32') execSync(`start "" "${url}"`);
    else execSync(`xdg-open "${url}"`);
  } catch {
    // Silently fail — user can copy the URL from the console
  }
}

function buildCallbackHtml(state) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Nometria - Signing In</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
           display: flex; align-items: center; justify-content: center;
           min-height: 100vh; background: #faf9f7; color: #1a1a1a; }
    .card { text-align: center; padding: 48px; max-width: 420px; }
    h1 { font-size: 20px; font-weight: 600; margin-bottom: 8px; }
    p { font-size: 14px; color: #666; line-height: 1.5; }
    .spinner { width: 24px; height: 24px; border: 3px solid #e5e5e5;
               border-top-color: #1a1a1a; border-radius: 50%;
               animation: spin 0.8s linear infinite; margin: 16px auto; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .success { display: none; }
    .error { display: none; color: #dc2626; }
  </style>
</head>
<body>
  <div class="card">
    <div id="loading">
      <div class="spinner"></div>
      <h1>Completing sign-in...</h1>
      <p>Connecting your account to the CLI.</p>
    </div>
    <div id="success" class="success">
      <h1>Signed in!</h1>
      <p>You can close this tab and return to your terminal.</p>
    </div>
    <div id="error" class="error">
      <h1>Sign-in failed</h1>
      <p id="error-msg">An unexpected error occurred.</p>
    </div>
  </div>
  <script>
    (async () => {
      try {
        const hash = window.location.hash.substring(1);
        const query = window.location.search.substring(1);
        const params = new URLSearchParams(hash || query);
        const token = params.get("access_token");
        if (!token) throw new Error("No access token received");
        const res = await fetch("/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            access_token: token,
            email: params.get("email"),
            expires_at: params.get("expires_at"),
            state: ${JSON.stringify(state)}
          }),
        });
        if (!res.ok) throw new Error("Failed to send token to CLI");
        document.getElementById("loading").style.display = "none";
        document.getElementById("success").style.display = "block";
      } catch (e) {
        document.getElementById("loading").style.display = "none";
        document.getElementById("error").style.display = "block";
        document.getElementById("error-msg").textContent = e.message;
      }
    })();
  </script>
</body>
</html>`;
}
