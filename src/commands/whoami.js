/**
 * nom whoami — Show current authenticated user via Deno functions.
 */
import { requireApiKey } from '../lib/auth.js';
import { apiRequest } from '../lib/api.js';

export async function whoami(flags) {
  const apiKey = requireApiKey();
  const result = await apiRequest('/cli/auth', {
    body: { api_key: apiKey },
  });

  if (flags.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`\n  Logged in as: ${result.email}\n`);
  }
}
