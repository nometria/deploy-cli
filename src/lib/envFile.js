/**
 * Parse a .env file into key/value pairs and project it onto the
 * nometria.json `env` block using `@env:` interpolation.
 *
 * The deploy pipeline (see config.js resolveEnv) reads `@env:VAR` at deploy
 * time from the local process environment, so secrets never live in the
 * committed config. This module is the inverse: given a pasted .env, produce
 * the `env` object you'd drop into nometria.json plus the list of variable
 * names a CI job must inject.
 *
 * Pure, dependency-free, and shared between the CLI and the web tool so both
 * stay byte-for-byte in sync.
 */

// Same heuristics the `nom env` command uses to flag secrets.
const SECRET_PATTERNS = [
  /^sk[-_]/i, /^pk[-_]/i, /secret/i, /password/i, /token/i,
  /api[-_]?key/i, /private[-_]?key/i, /^ghp_/, /^gho_/, /^nometria_sk_/,
];

export function looksLikeSecret(key, value) {
  if (SECRET_PATTERNS.some(p => p.test(key))) return true;
  if (value && value.length > 20 && /^[A-Za-z0-9+/=_-]+$/.test(value)) return true;
  return false;
}

/**
 * Parse raw .env text. Supports `KEY=VALUE`, `export KEY=VALUE`, `#` comments,
 * blank lines, inline `# comments`, and single/double quoted values.
 *
 * Returns an array of { key, value, secret, line, error? } in file order.
 */
export function parseEnv(text) {
  const out = [];
  const lines = String(text || '').split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;

    const withoutExport = line.replace(/^export\s+/, '');
    const eq = withoutExport.indexOf('=');
    if (eq === -1) {
      out.push({ key: withoutExport, value: '', secret: false, line: i + 1, error: 'missing "="' });
      continue;
    }

    const key = withoutExport.slice(0, eq).trim();
    let value = withoutExport.slice(eq + 1).trim();

    // Strip surrounding quotes; only strip inline comments on unquoted values.
    const quoted = /^(['"]).*\1$/.test(value);
    if (quoted) {
      value = value.slice(1, -1);
    } else {
      const hash = value.indexOf(' #');
      if (hash !== -1) value = value.slice(0, hash).trim();
    }

    const validKey = /^[A-Za-z_][A-Za-z0-9_]*$/.test(key);
    out.push({
      key,
      value,
      secret: looksLikeSecret(key, value),
      line: i + 1,
      ...(validKey ? {} : { error: 'invalid variable name' }),
    });
  }
  return out;
}

/**
 * Build the nometria.json `env` object from parsed entries.
 *
 * Secrets become `@env:KEY` references (resolved from the environment at deploy
 * time); plain config values are inlined. Pass { allSecret: true } to force
 * every var through `@env:` (recommended for anything that will live in git).
 */
export function toEnvConfig(entries, { allSecret = false } = {}) {
  const env = {};
  for (const e of entries) {
    if (e.error) continue;
    env[e.key] = (allSecret || e.secret) ? `@env:${e.key}` : e.value;
  }
  return env;
}

/** Variable names that are referenced via `@env:` and must be injected by CI. */
export function secretKeys(envConfig) {
  return Object.entries(envConfig)
    .filter(([, v]) => typeof v === 'string' && v.startsWith('@env:'))
    .map(([, v]) => v.slice(5));
}
