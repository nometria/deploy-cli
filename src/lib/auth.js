/**
 * API key resolution: NOMETRIA_API_KEY env > ~/.nometria/credentials.json
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CREDENTIALS_DIR = join(homedir(), '.nometria');
const CREDENTIALS_FILE = join(CREDENTIALS_DIR, 'credentials.json');

export function getApiKey() {
  // Env var takes priority (API key format)
  if (process.env.NOMETRIA_API_KEY) {
    return process.env.NOMETRIA_API_KEY;
  }
  // Also accept JWT token from VS Code extension / Claude Code commands
  if (process.env.NOMETRIA_TOKEN) {
    return process.env.NOMETRIA_TOKEN;
  }
  // Fall back to stored credentials
  if (existsSync(CREDENTIALS_FILE)) {
    try {
      const creds = JSON.parse(readFileSync(CREDENTIALS_FILE, 'utf8'));
      if (creds.apiKey) return creds.apiKey;
    } catch { /* ignore malformed file */ }
  }
  return null;
}

export function requireApiKey() {
  const key = getApiKey();
  if (!key) {
    const err = new Error('Not authenticated');
    err.code = 'ERR_AUTH';
    throw err;
  }
  return key;
}

export function saveApiKey(apiKey) {
  if (!existsSync(CREDENTIALS_DIR)) {
    mkdirSync(CREDENTIALS_DIR, { recursive: true });
  }
  writeFileSync(CREDENTIALS_FILE, JSON.stringify({ apiKey }, null, 2) + '\n', {
    mode: 0o600, // owner-only read/write
  });
  return CREDENTIALS_FILE;
}

export function clearApiKey() {
  if (existsSync(CREDENTIALS_FILE)) {
    writeFileSync(CREDENTIALS_FILE, JSON.stringify({}, null, 2) + '\n', {
      mode: 0o600,
    });
  }
}
