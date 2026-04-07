#!/usr/bin/env node
/**
 * nom — Deploy any project to any cloud from your terminal.
 *
 * Commands:
 *   nom init      Create a nometria.json config file
 *   nom deploy    Deploy to production (default)
 *   nom preview   Deploy a staging preview
 *   nom status    Check deployment status
 *   nom logs      View deployment logs
 *   nom login     Authenticate with your API key
 *   nom whoami    Show current authenticated user
 */

import { parseArgs } from 'node:util';
import { init } from './commands/init.js';
import { deploy } from './commands/deploy.js';
import { preview } from './commands/preview.js';
import { status } from './commands/status.js';
import { logs } from './commands/logs.js';
import { login } from './commands/login.js';
import { whoami } from './commands/whoami.js';
import { github } from './commands/github.js';
import { start } from './commands/start.js';
import { stop } from './commands/stop.js';
import { terminate } from './commands/terminate.js';
import { upgrade } from './commands/upgrade.js';
import { domain } from './commands/domain.js';
import { env } from './commands/env.js';
import { scan } from './commands/scan.js';
import { setup } from './commands/setup.js';
import { list } from './commands/list.js';
import { rollback } from './commands/rollback.js';
import { ssh } from './commands/ssh.js';
import { db } from './commands/db.js';
import { cron } from './commands/cron.js';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    help:    { type: 'boolean', short: 'h', default: false },
    version: { type: 'boolean', short: 'v', default: false },
    yes:     { type: 'boolean', short: 'y', default: false },
    follow:  { type: 'boolean', short: 'f', default: false },
    json:      { type: 'boolean', default: false },
    from:      { type: 'string' },
    'api-key': { type: 'boolean', default: false },
    token:     { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
    preview:   { type: 'boolean', default: false },
    production:{ type: 'boolean', default: false },
    message:   { type: 'string', short: 'm' },
  },
  strict: false,
});

if (values.version) {
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { dirname, join } = await import('node:path');
  const dir = dirname(fileURLToPath(import.meta.url));
  const pkg = JSON.parse(readFileSync(join(dir, '..', 'package.json'), 'utf8'));
  console.log(pkg.version);
  process.exit(0);
}

// Ensure Ctrl+C always exits cleanly
process.on('SIGINT', () => {
  console.log('\n');
  process.exit(130);
});

const command = positionals[0] || 'deploy';

if (values.help) {
  printHelp();
  process.exit(0);
}

const commands = {
  init,
  deploy,
  preview,
  status,
  logs,
  login,
  whoami,
  github,
  start,
  stop,
  terminate,
  upgrade,
  domain,
  env,
  scan,
  setup,
  list,
  rollback,
  ssh,
  db,
  cron,
};

const handler = commands[command];
if (!handler) {
  console.error(`Unknown command: ${command}`);
  printHelp();
  process.exit(1);
}

try {
  await handler(values, positionals.slice(1));
} catch (err) {
  if (err.code === 'ERR_AUTH') {
    console.error(`\n  Not authenticated. Run: nom login`);
    console.error(`  Get your API key at: https://nometria.com/settings/api-keys\n`);
  } else if (err.code === 'ERR_CONFIG') {
    console.error(`\n  No nometria.json found. Run: nom init`);
    console.error(`  Docs: https://docs.nometria.com/cli/install\n`);
  } else if (err.status === 402) {
    console.error(`\n  Payment required. Upgrade your plan:`);
    console.error(`  https://nometria.com/pricing\n`);
  } else if (err.status === 404) {
    console.error(`\n  App not found. List your apps: nom list`);
    console.error(`  Dashboard: https://nometria.com/dashboard\n`);
  } else if (err.status === 429) {
    console.error(`\n  Rate limited. Wait a moment and try again.\n`);
  } else {
    console.error(`\n  Error: ${err.message}`);
    console.error(`  Docs: https://docs.nometria.com`);
    console.error(`  Dashboard: https://nometria.com/dashboard`);
    if (process.env.NOM_DEBUG) console.error(err.stack);
    console.error();
  }
  process.exit(1);
}

function printHelp() {
  console.log(`
  nom — Deploy any project to any cloud.

  Usage:
    nom [command] [options]

  Commands:
    init                Create a nometria.json config file
    deploy              Deploy to production (default)
    preview             Deploy a staging preview
    status              Check deployment status
    list                List all your apps
    rollback [id]       Roll back to a previous deployment
    logs [-f]           View deployment logs
    login               Sign in via browser (or --api-key)
    whoami              Show current user

    github connect      Connect GitHub for auto-deploy
    github status       Check GitHub connection
    github repos        List connected repos
    github push [-m]    Push changes to GitHub

    start               Start a stopped instance
    stop                Stop a running instance
    terminate           Terminate instance permanently
    upgrade <size>      Upgrade instance (2gb/4gb/8gb/16gb)
    ssh [command]       Connect to instance or run remote command

    db backup           Create a database backup
    db restore <id>     Restore from a backup
    db shell            Show database connection details
    db migrate          Run pending migrations

    domain add <domain> Add custom domain
    env set KEY=VALUE   Set environment variables
    env list            List environment variables
    env delete KEY      Delete environment variable
    scan                Run AI security scan
    cron add <s> <cmd>  Add a scheduled task
    cron list           List cron jobs
    cron delete <id>    Delete a cron job

  Options:
    -h, --help       Show this help
    -v, --version    Show version
    -y, --yes        Skip confirmation prompts
    -f, --follow     Follow logs in real-time
    -m, --message    Commit message (for github push)
    --json           Output as JSON
    --dry-run        Validate config and build without deploying
    --preview        Target preview environment (for nom env)
    --production     Target production environment (for nom env)
    --api-key        Login with API key paste instead of browser
    --from <url>     Deploy from a GitHub URL

  Examples:
    nom login                    Sign in via browser
    nom init                     Set up a new project
    nom deploy                   Deploy current directory
    nom github connect           Connect GitHub for auto-deploy
    nom status                   Check deployment status
    nom logs -f                  Stream live logs
    nom upgrade 8gb              Upgrade instance to 8gb
    nom env set DB_URL=postgres://...
    nom scan                     Run AI security scan
    nom setup                    Generate AI tool configs (Cursor, Copilot, etc.)

  Environment:
    NOMETRIA_API_KEY    API key (overrides stored credentials)
    NOM_DEBUG           Enable debug output
`);
}
