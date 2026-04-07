/**
 * Read and validate nometria.json config
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const CONFIG_FILE = 'nometria.json';

const VALID_PLATFORMS = ['aws', 'gcp', 'azure', 'digitalocean', 'hetzner', 'vercel', 'render'];
const VALID_FRAMEWORKS = ['vite', 'nextjs', 'remix', 'static', 'node', 'deno', 'expo', 'python'];
const VALID_INSTANCE_TYPES = ['2gb', '4gb', '8gb', '16gb', '32gb'];

export function readConfig(dir = process.cwd()) {
  const configPath = join(dir, CONFIG_FILE);
  if (!existsSync(configPath)) {
    const err = new Error(`${CONFIG_FILE} not found in ${dir}`);
    err.code = 'ERR_CONFIG';
    throw err;
  }
  const raw = readFileSync(configPath, 'utf8');
  const config = JSON.parse(raw);
  return validate(config);
}

export function configExists(dir = process.cwd()) {
  return existsSync(join(dir, CONFIG_FILE));
}

function validate(config) {
  // "name" is required for CLI deploys; "app_id" alone is enough for linked apps
  if (!config.name && !config.app_id) {
    throw new Error('nometria.json: either "name" or "app_id" is required');
  }
  if (config.name) {
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(config.name) && config.name.length > 1) {
      if (!/^[a-z0-9-]+$/.test(config.name)) {
        throw new Error('nometria.json: "name" must be lowercase alphanumeric with hyphens');
      }
    }
  }

  config.platform = config.platform || 'aws';
  if (!VALID_PLATFORMS.includes(config.platform)) {
    throw new Error(`nometria.json: "platform" must be one of: ${VALID_PLATFORMS.join(', ')}`);
  }

  if (config.framework && !VALID_FRAMEWORKS.includes(config.framework)) {
    throw new Error(`nometria.json: "framework" must be one of: ${VALID_FRAMEWORKS.join(', ')}`);
  }

  config.instanceType = config.instanceType || '4gb';
  if (!VALID_INSTANCE_TYPES.includes(config.instanceType)) {
    throw new Error(`nometria.json: "instanceType" must be one of: ${VALID_INSTANCE_TYPES.join(', ')}`);
  }

  config.region = config.region || 'us-east-1';
  config.ignore = config.ignore || [];
  config.build = config.build || {};
  config.env = config.env || {};

  // Optional fields from IDE extension linking
  // app_id, migration_id, api_url are preserved but not required for CLI init
  return config;
}

export function updateConfig(dir, updates) {
  const configPath = join(dir, CONFIG_FILE);
  let config = {};
  if (existsSync(configPath)) {
    config = JSON.parse(readFileSync(configPath, 'utf8'));
  }
  Object.assign(config, updates);
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
}

export function resolveEnv(envConfig) {
  const resolved = {};
  for (const [key, value] of Object.entries(envConfig)) {
    if (typeof value === 'string' && value.startsWith('@env:')) {
      const envVar = value.slice(5);
      const envValue = process.env[envVar];
      if (!envValue) {
        throw new Error(`Environment variable ${envVar} is not set (referenced by ${key})`);
      }
      resolved[key] = envValue;
    } else {
      resolved[key] = value;
    }
  }
  return resolved;
}

export { CONFIG_FILE, VALID_PLATFORMS, VALID_FRAMEWORKS, VALID_INSTANCE_TYPES };
