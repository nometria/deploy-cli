/**
 * nom services - Manage backend services (databases, caches, storage).
 *
 * Subcommands:
 *   add <type>       Add a service (postgres, mysql, mongodb, redis, minio)
 *   list             List running services
 *   remove <name>    Remove a service
 *   info <name>      Show connection details for a service
 */
import { readConfig } from '../lib/config.js';
import { requireApiKey } from '../lib/auth.js';
import { apiRequest } from '../lib/api.js';

const AVAILABLE_SERVICES = {
  postgres:  { label: 'PostgreSQL 16', port: 5432, envVar: 'DATABASE_URL' },
  mysql:     { label: 'MySQL 8.4',     port: 3306, envVar: 'MYSQL_URL' },
  mongodb:   { label: 'MongoDB 7',     port: 27017, envVar: 'MONGODB_URL' },
  redis:     { label: 'Redis 7',       port: 6379, envVar: 'REDIS_URL' },
  minio:     { label: 'MinIO (S3)',    port: 9000, envVar: 'S3_ENDPOINT' },
};

export async function services(flags, positionals) {
  const sub = positionals[0];

  switch (sub) {
    case 'add':
      return servicesAdd(flags, positionals[1]);
    case 'list':
    case 'ls':
      return servicesList(flags);
    case 'remove':
    case 'rm':
      return servicesRemove(flags, positionals[1]);
    case 'info':
      return servicesInfo(flags, positionals[1]);
    default:
      console.log(`
  Usage: nom services <command>

  Commands:
    add <type>       Add a backend service
    list             List running services
    remove <name>    Remove a service
    info <name>      Show connection details

  Available services:
    postgres         PostgreSQL 16 (port 5432)
    mysql            MySQL 8.4 (port 3306)
    mongodb          MongoDB 7 (port 27017)
    redis            Redis 7 (port 6379)
    minio            MinIO S3-compatible storage (port 9000/9001)

  Examples:
    nom services add postgres
    nom services add redis
    nom services list
    nom services info postgres

  Help: https://docs.nometria.com/services
`);
  }
}

async function servicesAdd(flags, serviceType) {
  if (!serviceType) {
    console.error('\n  Specify a service type: nom services add <postgres|mysql|mongodb|redis|minio>\n');
    process.exit(1);
  }

  const svcInfo = AVAILABLE_SERVICES[serviceType];
  if (!svcInfo) {
    console.error(`\n  Unknown service: ${serviceType}`);
    console.error(`  Available: ${Object.keys(AVAILABLE_SERVICES).join(', ')}\n`);
    process.exit(1);
  }

  const apiKey = requireApiKey();
  const config = readConfig();
  const appId = config.app_id;

  if (!appId) {
    console.error('\n  No app_id in nometria.json. Deploy first: nom deploy\n');
    process.exit(1);
  }

  console.log(`\n  Adding ${svcInfo.label} to ${config.name || appId}...\n`);

  try {
    const result = await apiRequest('/cli/services', {
      apiKey,
      body: { app_id: appId, action: 'add', service: serviceType },
    });

    if (flags.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.log(`  ${svcInfo.label} provisioned successfully!`);
    console.log();
    if (result.connection_string) {
      console.log(`  Connection:  ${result.connection_string}`);
    }
    console.log(`  Port:        ${result.port || svcInfo.port}`);
    console.log(`  Env var:     ${result.env_var || svcInfo.envVar}`);
    console.log();
    console.log('  The connection string has been injected as an environment variable.');
    console.log('  Your app can access it immediately.\n');
  } catch (err) {
    console.error(`\n  Failed to add ${serviceType}: ${err.message}`);
    console.error('  Make sure the instance is running: nom status\n');
    process.exit(1);
  }
}

async function servicesList(flags) {
  const apiKey = requireApiKey();
  const config = readConfig();
  const appId = config.app_id;

  if (!appId) {
    console.error('\n  No app_id in nometria.json. Deploy first: nom deploy\n');
    process.exit(1);
  }

  try {
    const result = await apiRequest('/cli/services', {
      apiKey,
      body: { app_id: appId, action: 'list' },
    });

    if (flags.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    const svcs = result.services || [];
    if (!svcs.length) {
      console.log('\n  No backend services running.\n');
      console.log('  Add one:');
      for (const [key, info] of Object.entries(AVAILABLE_SERVICES)) {
        console.log(`    nom services add ${key.padEnd(10)} ${info.label}`);
      }
      console.log();
      return;
    }

    console.log(`\n  Backend services for ${config.name || appId}:\n`);
    for (const svc of svcs) {
      const status = svc.status === 'running' ? '●' : '○';
      console.log(`  ${status} ${svc.name || svc.type}`);
      console.log(`    Type:       ${svc.type}:${svc.version || 'latest'}`);
      console.log(`    Port:       ${svc.port}`);
      console.log(`    Status:     ${svc.status || 'unknown'}`);
      if (svc.connection_string) {
        console.log(`    Connection: ${svc.connection_string}`);
      }
      console.log();
    }
  } catch (err) {
    console.error(`\n  Failed to list services: ${err.message}\n`);
    process.exit(1);
  }
}

async function servicesRemove(flags, serviceName) {
  if (!serviceName) {
    console.error('\n  Specify a service to remove: nom services remove <name>\n');
    process.exit(1);
  }

  const apiKey = requireApiKey();
  const config = readConfig();
  const appId = config.app_id;

  if (!appId) {
    console.error('\n  No app_id in nometria.json.\n');
    process.exit(1);
  }

  console.log(`\n  Removing ${serviceName}...\n`);

  try {
    const result = await apiRequest('/cli/services', {
      apiKey,
      body: { app_id: appId, action: 'remove', service: serviceName },
    });

    if (result.success) {
      console.log(`  ${serviceName} removed.\n`);
    } else {
      console.error(`  Failed: ${result.error}\n`);
      process.exit(1);
    }
  } catch (err) {
    console.error(`\n  Failed to remove ${serviceName}: ${err.message}\n`);
    process.exit(1);
  }
}

async function servicesInfo(flags, serviceName) {
  if (!serviceName) {
    console.error('\n  Specify a service: nom services info <name>\n');
    process.exit(1);
  }

  const apiKey = requireApiKey();
  const config = readConfig();
  const appId = config.app_id;

  if (!appId) {
    console.error('\n  No app_id in nometria.json.\n');
    process.exit(1);
  }

  try {
    const result = await apiRequest('/cli/services', {
      apiKey,
      body: { app_id: appId, action: 'info', service: serviceName },
    });

    if (flags.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.log(`\n  Service: ${result.name || serviceName}`);
    console.log(`  Type:    ${result.type || serviceName}`);
    console.log(`  Version: ${result.version || 'latest'}`);
    console.log(`  Port:    ${result.port || '-'}`);
    console.log(`  Status:  ${result.status || 'unknown'}`);
    if (result.connection_string) {
      console.log(`  Connection: ${result.connection_string}`);
    }
    if (result.env_var) {
      console.log(`  Env var: ${result.env_var}`);
    }
    console.log();
  } catch (err) {
    console.error(`\n  Failed to get info for ${serviceName}: ${err.message}\n`);
    process.exit(1);
  }
}
