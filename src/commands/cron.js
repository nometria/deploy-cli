/**
 * nom cron — Manage scheduled tasks on deployed instances.
 *
 * Subcommands:
 *   add <schedule> <command>   Add a cron job (e.g., nom cron add "0 3 * * *" "npm run cleanup")
 *   list                      List active cron jobs
 *   delete <id>               Delete a cron job
 */
import { readConfig } from '../lib/config.js';
import { requireApiKey } from '../lib/auth.js';
import { apiRequest } from '../lib/api.js';

export async function cron(flags, positionals) {
  const sub = positionals[0];

  switch (sub) {
    case 'add':
      return cronAdd(flags, positionals.slice(1));
    case 'list':
    case 'ls':
      return cronList(flags);
    case 'delete':
    case 'rm':
      return cronDelete(flags, positionals[1]);
    default:
      console.log(`
  Usage: nom cron <command>

  Commands:
    add <schedule> <cmd>   Add a cron job
    list                   List active cron jobs
    delete <id>            Delete a cron job

  Schedule format: standard cron expression
    "0 3 * * *"            Daily at 3am UTC
    "*/15 * * * *"         Every 15 minutes
    "0 0 * * 0"            Weekly on Sunday

  Examples:
    nom cron add "0 3 * * *" "npm run cleanup"
    nom cron add "*/5 * * * *" "curl -sf https://myapp.com/health"
    nom cron list
    nom cron delete cron_abc123

  Help: https://docs.nometria.com/deploy/environment
`);
  }
}

async function cronAdd(flags, args) {
  const apiKey = requireApiKey();
  const config = readConfig();
  const appId = config.app_id;

  if (!appId) {
    console.error('\n  No app_id in nometria.json. Deploy first: nom deploy\n');
    process.exit(1);
  }

  if (args.length < 2) {
    console.error('\n  Usage: nom cron add "<schedule>" "<command>"');
    console.error('  Example: nom cron add "0 3 * * *" "npm run cleanup"\n');
    process.exit(1);
  }

  const schedule = args[0];
  const command = args.slice(1).join(' ');

  // Basic cron validation
  const parts = schedule.split(/\s+/);
  if (parts.length < 5 || parts.length > 6) {
    console.error(`\n  Invalid cron schedule: "${schedule}"`);
    console.error('  Expected format: "minute hour day month weekday"');
    console.error('  Example: "0 3 * * *" (daily at 3am UTC)\n');
    process.exit(1);
  }

  try {
    const result = await apiRequest('/cli/cron', {
      apiKey,
      body: { app_id: appId, action: 'add', schedule, command },
    });

    console.log(`\n  Cron job added: ${result.cron_id || 'pending'}`);
    console.log(`  Schedule: ${schedule}`);
    console.log(`  Command:  ${command}`);
    console.log(`  Timezone: UTC\n`);
  } catch (err) {
    console.error(`\n  Failed to add cron job: ${err.message}`);
    console.error('  Help: https://docs.nometria.com/deploy/environment\n');
    process.exit(1);
  }
}

async function cronList(flags) {
  const apiKey = requireApiKey();
  const config = readConfig();
  const appId = config.app_id;

  if (!appId) {
    console.error('\n  No app_id in nometria.json.\n');
    process.exit(1);
  }

  try {
    const result = await apiRequest('/cli/cron', {
      apiKey,
      body: { app_id: appId, action: 'list' },
    });

    const jobs = result.jobs || [];
    if (!jobs.length) {
      console.log('\n  No cron jobs configured. Add one: nom cron add "0 3 * * *" "npm run cleanup"\n');
      return;
    }

    if (flags.json) {
      console.log(JSON.stringify(jobs, null, 2));
      return;
    }

    console.log(`\n  Cron jobs (${jobs.length}):\n`);
    for (const job of jobs) {
      console.log(`  ${job.id || '—'}`);
      console.log(`    Schedule: ${job.schedule}`);
      console.log(`    Command:  ${job.command}`);
      if (job.last_run) console.log(`    Last run: ${job.last_run}`);
      console.log();
    }
  } catch (err) {
    console.error(`\n  Failed to list cron jobs: ${err.message}\n`);
    process.exit(1);
  }
}

async function cronDelete(flags, cronId) {
  const apiKey = requireApiKey();
  const config = readConfig();
  const appId = config.app_id;

  if (!appId) {
    console.error('\n  No app_id in nometria.json.\n');
    process.exit(1);
  }

  if (!cronId) {
    console.error('\n  Usage: nom cron delete <cron_id>');
    console.error('  List jobs first: nom cron list\n');
    process.exit(1);
  }

  try {
    await apiRequest('/cli/cron', {
      apiKey,
      body: { app_id: appId, action: 'delete', cron_id: cronId },
    });
    console.log(`\n  Cron job ${cronId} deleted.\n`);
  } catch (err) {
    console.error(`\n  Failed to delete cron job: ${err.message}\n`);
    process.exit(1);
  }
}
