/**
 * Anonymous CLI telemetry — tracks deployment funnel to identify drop-off points.
 *
 * Opt-out: set NOM_TELEMETRY=0 or run `nom config telemetry false`
 *
 * What we track:
 *   - Command name (deploy, init, preview, etc.)
 *   - Framework detected
 *   - Success/failure
 *   - Duration
 *
 * What we DON'T track:
 *   - App names, URLs, or content
 *   - API keys or tokens
 *   - File paths or code
 *   - IP addresses (server-side)
 */
import { homedir } from 'node:os';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const TELEMETRY_ENDPOINT = 'https://app.nometria.com/cli/telemetry';
const CONFIG_PATH = join(homedir(), '.nometria', 'config.json');

function isEnabled() {
  // Env var override
  if (process.env.NOM_TELEMETRY === '0' || process.env.NOM_TELEMETRY === 'false') return false;
  if (process.env.DO_NOT_TRACK === '1') return false;  // Respect consented.org standard

  // Config file override
  try {
    if (existsSync(CONFIG_PATH)) {
      const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
      if (config.telemetry === false) return false;
    }
  } catch { /* ignore */ }

  return true;
}

/**
 * Record a CLI event. Non-blocking — fire and forget.
 */
export function trackEvent(event, properties = {}) {
  if (!isEnabled()) return;

  const payload = {
    event,
    properties: {
      ...properties,
      cli_version: getCliVersion(),
      node_version: process.version,
      platform: process.platform,
      arch: process.arch,
    },
    timestamp: new Date().toISOString(),
  };

  // Fire and forget — never block the CLI
  try {
    fetch(TELEMETRY_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(3000),
    }).catch(() => { /* silently ignore */ });
  } catch { /* silently ignore */ }
}

/**
 * Track command start. Returns a finish function to record duration.
 */
export function trackCommand(command, metadata = {}) {
  const start = Date.now();
  trackEvent('command_start', { command, ...metadata });

  return {
    success(extra = {}) {
      trackEvent('command_success', {
        command,
        duration_ms: Date.now() - start,
        ...metadata,
        ...extra,
      });
    },
    fail(error, extra = {}) {
      trackEvent('command_fail', {
        command,
        duration_ms: Date.now() - start,
        error: typeof error === 'string' ? error : error?.message || 'unknown',
        ...metadata,
        ...extra,
      });
    },
  };
}

/**
 * Set telemetry preference.
 */
export function setTelemetry(enabled) {
  const dir = join(homedir(), '.nometria');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  let config = {};
  try {
    if (existsSync(CONFIG_PATH)) config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
  } catch { /* start fresh */ }

  config.telemetry = enabled;
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n');
}

function getCliVersion() {
  try {
    const { fileURLToPath } = await import('node:url');
    const { dirname } = await import('node:path');
    const dir = dirname(fileURLToPath(import.meta.url));
    const pkg = JSON.parse(readFileSync(join(dir, '..', '..', 'package.json'), 'utf8'));
    return pkg.version;
  } catch {
    return 'unknown';
  }
}
