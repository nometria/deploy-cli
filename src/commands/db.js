/**
 * nom db — Database management commands.
 *
 * Subcommands:
 *   backup          Create a database backup
 *   restore <id>    Restore from a backup
 *   shell           Show connection instructions
 *   migrate         Run pending migrations
 */
import { readConfig } from '../lib/config.js';
import { requireApiKey } from '../lib/auth.js';
import { apiRequest } from '../lib/api.js';

export async function db(flags, positionals) {
  const sub = positionals[0];

  switch (sub) {
    case 'backup':
      return dbBackup(flags);
    case 'restore':
      return dbRestore(flags, positionals[1]);
    case 'shell':
      return dbShell(flags);
    case 'migrate':
      return dbMigrate(flags);
    case 'ownership':
    case 'own':
      return dbOwnership(flags);
    default:
      console.log(`
  Usage: nom db <command>

  Commands:
    backup            Create a database backup
    restore <id>      Restore from a backup
    shell             Show database connection details
    migrate           Run pending migrations
    ownership         Transfer database to your own Supabase project

  Help: https://docs.nometria.com/deploy/environment
`);
  }
}

async function dbBackup(flags) {
  const apiKey = requireApiKey();
  const config = readConfig();
  const appId = config.app_id;

  if (!appId) {
    console.error('\n  No app_id in nometria.json. Deploy first: nom deploy\n');
    process.exit(1);
  }

  console.log('\n  Creating database backup...\n');
  try {
    const result = await apiRequest('/cli/db', {
      apiKey,
      body: { app_id: appId, action: 'backup' },
    });

    if (flags.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.log(`  Backup created: ${result.backup_id || 'pending'}`);
    if (result.size) console.log(`  Size: ${result.size}`);
    if (result.s3_path) console.log(`  Stored: ${result.s3_path}`);
    console.log();
  } catch (err) {
    console.error(`\n  Backup failed: ${err.message}`);
    console.error('  This may require the app to have a running database.');
    console.error('  Help: https://docs.nometria.com/deploy/environment\n');
    process.exit(1);
  }
}

async function dbRestore(flags, backupId) {
  const apiKey = requireApiKey();
  const config = readConfig();
  const appId = config.app_id;

  if (!appId) {
    console.error('\n  No app_id in nometria.json.\n');
    process.exit(1);
  }

  if (!backupId) {
    // List available backups
    console.log('\n  Fetching available backups...\n');
    try {
      const result = await apiRequest('/cli/db', {
        apiKey,
        body: { app_id: appId, action: 'list_backups' },
      });
      const backups = result.backups || [];
      if (!backups.length) {
        console.log('  No backups found. Create one: nom db backup\n');
        return;
      }
      console.log('  Available backups:\n');
      for (const b of backups) {
        console.log(`  ${b.id}  ${b.created_at || '—'}  ${b.size || '—'}`);
      }
      console.log('\n  Restore: nom db restore <backup_id>\n');
    } catch (err) {
      console.error(`\n  Failed to list backups: ${err.message}\n`);
    }
    return;
  }

  console.log(`\n  Restoring from backup: ${backupId}...\n`);
  try {
    const result = await apiRequest('/cli/db', {
      apiKey,
      body: { app_id: appId, action: 'restore', backup_id: backupId },
    });
    console.log(`  Restore ${result.success ? 'completed' : 'failed'}.`);
    if (result.message) console.log(`  ${result.message}`);
    console.log();
  } catch (err) {
    console.error(`\n  Restore failed: ${err.message}\n`);
    process.exit(1);
  }
}

async function dbShell(flags) {
  const apiKey = requireApiKey();
  const config = readConfig();
  const appId = config.app_id;

  if (!appId) {
    console.error('\n  No app_id in nometria.json.\n');
    process.exit(1);
  }

  // Get instance details for connection info
  try {
    const result = await apiRequest('/checkAwsStatus', {
      apiKey,
      body: { app_id: appId },
    });
    const ip = result.data?.ipAddress;

    console.log(`\n  Database connection for: ${appId}\n`);
    console.log('  Via SSH tunnel (recommended):');
    if (ip) {
      console.log(`    ssh -L 5432:localhost:5432 ubuntu@${ip}`);
      console.log('    psql postgresql://postgres:postgres@localhost:5432/postgres\n');
    }
    console.log('  Via SSM:');
    const instanceId = result.data?.instanceId;
    if (instanceId) {
      console.log(`    aws ssm start-session --target ${instanceId} \\`);
      console.log('      --document-name AWS-StartPortForwardingSession \\');
      console.log("      --parameters '{\"portNumber\":[\"5432\"],\"localPortNumber\":[\"5432\"]}'\n");
    }
    console.log('  Direct on instance:');
    console.log('    psql postgresql://postgres:postgres@localhost:5432/postgres\n');
  } catch (err) {
    console.error(`\n  Could not fetch instance details: ${err.message}\n`);
    process.exit(1);
  }
}

async function dbMigrate(flags) {
  const apiKey = requireApiKey();
  const config = readConfig();
  const appId = config.app_id;

  if (!appId) {
    console.error('\n  No app_id in nometria.json.\n');
    process.exit(1);
  }

  console.log('\n  Running database migrations...\n');
  try {
    const result = await apiRequest('/cli/db', {
      apiKey,
      body: { app_id: appId, action: 'migrate' },
    });
    console.log(`  ${result.message || 'Migrations complete.'}\n`);
  } catch (err) {
    console.error(`\n  Migration failed: ${err.message}`);
    console.error('  Check migration files in db/seeds/ or schema.sql\n');
    process.exit(1);
  }
}

async function dbOwnership(flags) {
  const apiKey = requireApiKey();
  const config = readConfig();
  const appId = config.app_id;

  if (!appId) {
    console.error('\n  No app_id in nometria.json.\n');
    process.exit(1);
  }

  console.log(`
  Database Ownership Transfer
  ═══════════════════════════

  This transfers your app's database to a Supabase project YOU own.

  What happens:
    1. Export schema + data from current managed database
    2. Create a new Supabase project under your account
    3. Import schema + data into your project
    4. Update your app's .env to point to your Supabase
    5. Resync the app to use the new database

  After transfer:
    - You own the Supabase project directly
    - You control backups, scaling, and access
    - Nometria no longer manages the database
    - Your app keeps running with no downtime
`);

  try {
    console.log('  Step 1: Exporting current database...');
    const exportResult = await apiRequest('/cli/db', {
      apiKey,
      body: { app_id: appId, action: 'export_schema' },
    });
    console.log(`  Exported: ${exportResult.tables || '?'} tables, ${exportResult.rows || '?'} rows`);

    console.log('  Step 2: Creating your Supabase project...');
    const createResult = await apiRequest('/cli/db', {
      apiKey,
      body: { app_id: appId, action: 'create_owned_supabase' },
    });
    const supaUrl = createResult.supabase_url;
    console.log(`  Supabase project: ${supaUrl || 'pending'}`);

    console.log('  Step 3: Importing schema + data...');
    const importResult = await apiRequest('/cli/db', {
      apiKey,
      body: { app_id: appId, action: 'import_to_owned', supabase_url: supaUrl },
    });
    console.log(`  Imported: ${importResult.message || 'complete'}`);

    console.log('  Step 4: Updating app configuration...');
    const updateResult = await apiRequest('/cli/db', {
      apiKey,
      body: { app_id: appId, action: 'switch_to_owned', supabase_url: supaUrl },
    });
    console.log(`  ${updateResult.message || 'Configuration updated'}`);

    console.log(`
  Database ownership transferred!

  Your Supabase project: ${supaUrl || 'See Supabase dashboard'}
  Dashboard: https://supabase.com/dashboard
  App: https://nometria.com/AppDetails?app_id=${appId}

  Your app is now using YOUR Supabase project.
  You have full control over backups, scaling, and access.
`);
  } catch (err) {
    console.error(`\n  Ownership transfer failed: ${err.message}`);
    console.error('  This feature requires a running instance with Supabase.');
    console.error('  Help: https://docs.nometria.com/deploy/environment\n');
    process.exit(1);
  }
}
