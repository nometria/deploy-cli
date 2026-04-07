/**
 * nom ssh — Get SSH/exec access to a deployed instance.
 * Uses AWS SSM or provides SSH instructions.
 */
import { requireApiKey } from '../lib/auth.js';
import { apiRequest } from '../lib/api.js';
import { readConfig } from '../lib/config.js';

export async function ssh(flags, positionals) {
  const apiKey = requireApiKey();
  const config = readConfig();
  const appId = config.app_id;

  if (!appId) {
    console.error('\n  No app_id in nometria.json. Deploy first: nom deploy');
    console.error('  Docs: https://docs.nometria.com/cli/commands\n');
    process.exit(1);
  }

  // Get instance details
  const result = await apiRequest('/checkAwsStatus', {
    apiKey,
    body: { app_id: appId },
  });

  const data = result.data || result;
  const state = data.instanceState;
  const ip = data.ipAddress;
  const instanceId = data.instanceId;

  if (state !== 'running') {
    console.error(`\n  Instance is not running (state: ${state || 'unknown'}).`);
    console.error('  Start it first: nom start\n');
    process.exit(1);
  }

  if (!ip && !instanceId) {
    console.error('\n  Could not determine instance IP or ID.');
    console.error(`  Dashboard: https://nometria.com/AppDetails?app_id=${appId}\n`);
    process.exit(1);
  }

  // Check if user wants to run a command
  const command = positionals.join(' ');

  if (command) {
    // nom ssh <command> — execute remote command
    console.log(`\n  Running on ${appId} (${ip || instanceId}):\n`);
    try {
      const execResult = await apiRequest('/cli/exec', {
        apiKey,
        body: { app_id: appId, command },
      });
      console.log(execResult.output || execResult.stdout || '(no output)');
      if (execResult.stderr) console.error(execResult.stderr);
      console.log();
    } catch (err) {
      // Fallback: show SSH instructions
      console.error(`  Remote exec not available: ${err.message}\n`);
      showSshInstructions(ip, instanceId);
    }
  } else {
    // nom ssh — show connection instructions
    showSshInstructions(ip, instanceId);
  }
}

function showSshInstructions(ip, instanceId) {
  console.log('\n  Connect to your instance:\n');

  if (ip) {
    console.log(`  SSH:  ssh ubuntu@${ip}`);
    console.log(`        (requires your SSH key to be configured)\n`);
  }

  if (instanceId) {
    console.log(`  SSM:  aws ssm start-session --target ${instanceId}`);
    console.log(`        (requires AWS CLI + Session Manager plugin)\n`);
  }

  console.log('  Common debug commands:');
  console.log('    pm2 status                   Check running processes');
  console.log('    pm2 logs                     View app logs');
  console.log('    sudo nginx -t                Test nginx config');
  console.log('    cat /home/ubuntu/deploy.log  View deploy log');
  console.log('    df -h                        Check disk space');
  console.log();
}
