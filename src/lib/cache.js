/**
 * Simple file-based cache for CLI responses.
 * Stores cached data in ~/.nometria/cache/ with TTL-based expiration.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CACHE_DIR = join(homedir(), '.nometria', 'cache');
const DEFAULT_TTL = 60_000; // 1 minute

function ensureCacheDir() {
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }
}

/**
 * Get a cached value. Returns null if expired or not found.
 */
export function getCached(key, ttl = DEFAULT_TTL) {
  try {
    const path = join(CACHE_DIR, `${key}.json`);
    if (!existsSync(path)) return null;

    const raw = JSON.parse(readFileSync(path, 'utf8'));
    if (Date.now() - raw.timestamp > ttl) return null;
    return raw.data;
  } catch {
    return null;
  }
}

/**
 * Store a value in cache.
 */
export function setCache(key, data) {
  try {
    ensureCacheDir();
    const path = join(CACHE_DIR, `${key}.json`);
    writeFileSync(path, JSON.stringify({ timestamp: Date.now(), data }));
  } catch {
    // Non-fatal — cache write failure shouldn't break CLI
  }
}

/**
 * Cache-aware API request wrapper.
 * Uses cache for reads, bypasses for writes.
 */
export function withCache(key, ttl = DEFAULT_TTL) {
  return {
    get() { return getCached(key, ttl); },
    set(data) { setCache(key, data); },
  };
}
