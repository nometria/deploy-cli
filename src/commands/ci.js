/**
 * nom ci - Generate a GitHub Actions workflow that deploys on push.
 *
 * Reads nometria.json, detects the package manager, and writes
 * .github/workflows/deploy.yml. Prints the repo secrets you need to add.
 *
 * Flags:
 *   --branch <name>   Branch to deploy from (default: main)
 *   --preview         Also deploy a staging preview on pull_request
 *   --node <version>  Node version for the runner (default: 20)
 *   --yes             Overwrite an existing workflow without asking
 *   --json            Print { path, secrets, workflow } as JSON
 */
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { readConfig } from '../lib/config.js';
import { detectPackageManager } from '../lib/detect.js';
import { generateWorkflow, requiredSecrets, WORKFLOW_PATH } from '../lib/ciWorkflow.js';
import { confirm } from '../lib/prompt.js';

export async function ci(flags) {
  const dir = process.cwd();
  const config = readConfig(dir);
  const packageManager = detectPackageManager(dir);
  const branch = typeof flags.branch === 'string' ? flags.branch : 'main';
  const nodeVersion = typeof flags.node === 'string' ? flags.node : '20';
  const preview = !!flags.preview;

  const workflow = generateWorkflow({ config, packageManager, branch, nodeVersion, preview });
  const secrets = requiredSecrets(config);
  const outPath = join(dir, WORKFLOW_PATH);

  if (flags.json) {
    console.log(JSON.stringify({ path: WORKFLOW_PATH, secrets, workflow }, null, 2));
    return;
  }

  if (existsSync(outPath) && !flags.yes) {
    const overwrite = await confirm(`${WORKFLOW_PATH} already exists. Overwrite?`, false);
    if (!overwrite) {
      console.log('  Cancelled.\n');
      return;
    }
  }

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, workflow);

  console.log(`\n  Created ${WORKFLOW_PATH}\n`);
  console.log('  Add these repository secrets (Settings -> Secrets and variables -> Actions):');
  for (const s of secrets) {
    console.log(`    - ${s}`);
  }
  console.log('\n  Then push to ' + branch + ' and the workflow will deploy automatically.\n');
}
