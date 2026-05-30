/**
 * nom webhook - Manage deployment event webhooks.
 *
 * Subcommands:
 *   add <url>         Subscribe a URL to events
 *   list              List configured webhooks
 *   delete <id>       Remove a webhook
 *   test <id>         Send a test event to a webhook
 */
import { readConfig } from '../lib/config.js';
import { requireApiKey } from '../lib/auth.js';
import { apiRequest } from '../lib/api.js';

const VALID_EVENTS = [
  'deploy.started',
  'deploy.success',
  'deploy.failed',
  'preview.created',
  'instance.started',
  'instance.stopped',
  'backup.completed',
];

export async function webhook(flags, positionals) {
  const sub = positionals[0];

  switch (sub) {
    case 'add':
      return webhookAdd(flags, positionals[1]);
    case 'list':
    case 'ls':
      return webhookList(flags);
    case 'delete':
    case 'rm':
      return webhookDelete(flags, positionals[1]);
    case 'test':
      return webhookTest(flags, positionals[1]);
    default:
      console.log(`
  Usage: nom webhook <command>

  Commands:
    add <url>         Subscribe a URL to deployment events
    list              List configured webhooks
    delete <id>       Remove a webhook
    test <id>         Send a test event

  Options:
    --events <list>   Comma-separated events to subscribe to (default: all)

  Available events:
    ${VALID_EVENTS.join('\n    ')}

  Examples:
    nom webhook add https://example.com/hook
    nom webhook add https://slack.com/hook --events deploy.success,deploy.failed
    nom webhook list
    nom webhook test wh_abc123
    nom webhook delete wh_abc123

  Help: https://docs.nometria.com/webhooks
`);
  }
}

async function webhookAdd(flags, url) {
  if (!url) {
    console.error('\n  Specify a webhook URL: nom webhook add <url>\n');
    process.exit(1);
  }

  const apiKey = requireApiKey();
  const config = readConfig();
  const appId = config.app_id;

  if (!appId) {
    console.error('\n  No app_id in nometria.json. Deploy first: nom deploy\n');
    process.exit(1);
  }

  // Parse --events flag
  let events = [];
  const eventsFlag = flags.events;
  if (eventsFlag) {
    events = eventsFlag.split(',').map(e => e.trim());
    const invalid = events.filter(e => !VALID_EVENTS.includes(e));
    if (invalid.length) {
      console.error(`\n  Invalid events: ${invalid.join(', ')}`);
      console.error(`  Valid: ${VALID_EVENTS.join(', ')}\n`);
      process.exit(1);
    }
  }

  try {
    const result = await apiRequest('/cli/webhooks', {
      apiKey,
      body: { app_id: appId, action: 'add', url, events },
    });

    if (flags.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.log(`\n  Webhook added!`);
    console.log(`  ID:     ${result.webhook_id || '-'}`);
    console.log(`  URL:    ${url}`);
    console.log(`  Events: ${events.length ? events.join(', ') : 'all'}`);
    console.log();
  } catch (err) {
    console.error(`\n  Failed to add webhook: ${err.message}\n`);
    process.exit(1);
  }
}

async function webhookList(flags) {
  const apiKey = requireApiKey();
  const config = readConfig();
  const appId = config.app_id;

  if (!appId) {
    console.error('\n  No app_id in nometria.json.\n');
    process.exit(1);
  }

  try {
    const result = await apiRequest('/cli/webhooks', {
      apiKey,
      body: { app_id: appId, action: 'list' },
    });

    if (flags.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    const hooks = result.webhooks || [];
    if (!hooks.length) {
      console.log('\n  No webhooks configured.');
      console.log('  Add one: nom webhook add <url>\n');
      return;
    }

    console.log(`\n  Webhooks for ${config.name || appId}:\n`);
    for (const hook of hooks) {
      console.log(`  ${hook.id}`);
      console.log(`    URL:     ${hook.url}`);
      console.log(`    Events:  ${hook.events?.join(', ') || 'all'}`);
      console.log(`    Created: ${hook.created_at || '-'}`);
      console.log();
    }
  } catch (err) {
    console.error(`\n  Failed to list webhooks: ${err.message}\n`);
    process.exit(1);
  }
}

async function webhookDelete(flags, webhookId) {
  if (!webhookId) {
    console.error('\n  Specify a webhook ID: nom webhook delete <id>\n');
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
    const result = await apiRequest('/cli/webhooks', {
      apiKey,
      body: { app_id: appId, action: 'delete', webhook_id: webhookId },
    });
    console.log(result.success ? `\n  Webhook ${webhookId} deleted.\n` : `\n  Failed: ${result.error}\n`);
  } catch (err) {
    console.error(`\n  Failed to delete webhook: ${err.message}\n`);
    process.exit(1);
  }
}

async function webhookTest(flags, webhookId) {
  if (!webhookId) {
    console.error('\n  Specify a webhook ID: nom webhook test <id>\n');
    process.exit(1);
  }

  const apiKey = requireApiKey();
  const config = readConfig();
  const appId = config.app_id;

  if (!appId) {
    console.error('\n  No app_id in nometria.json.\n');
    process.exit(1);
  }

  console.log(`\n  Sending test event to webhook ${webhookId}...\n`);

  try {
    const result = await apiRequest('/cli/webhooks', {
      apiKey,
      body: { app_id: appId, action: 'test', webhook_id: webhookId },
    });
    if (result.success) {
      console.log(`  Test event sent. Status: ${result.response_status || '-'}\n`);
    } else {
      console.log(`  Test failed: ${result.error}\n`);
    }
  } catch (err) {
    console.error(`\n  Failed to test webhook: ${err.message}\n`);
    process.exit(1);
  }
}
