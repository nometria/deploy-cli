/**
 * nom logs — View deployment logs via Deno functions.
 */
import { readConfig } from '../lib/config.js';
import { requireApiKey } from '../lib/auth.js';
import { apiRequest } from '../lib/api.js';

export async function logs(flags) {
  const apiKey = requireApiKey();
  const config = readConfig();
  const appId = config.app_id || config.name;

  if (flags.follow) {
    console.log(`  Streaming logs for ${appId} (Ctrl+C to stop)\n`);
    while (true) {
      try {
        const result = await apiRequest('/cli/logs', {
          apiKey,
          body: { app_id: appId },
        });
        if (result.lines?.length) {
          for (const line of result.lines) {
            console.log(line);
          }
        }
      } catch { /* transient errors — keep polling */ }
      await new Promise(r => setTimeout(r, 2000));
    }
  } else {
    const result = await apiRequest('/cli/logs', {
      apiKey,
      body: { app_id: appId },
    });

    if (flags.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    if (!result.lines?.length) {
      console.log(`\n  No logs available for ${appId}\n`);
      return;
    }

    for (const line of result.lines) {
      console.log(line);
    }
  }
}
