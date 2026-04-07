/**
 * nom preview — Deploy a staging preview via Deno functions.
 */
import { execSync } from 'node:child_process';
import { readConfig, resolveEnv } from '../lib/config.js';
import { requireApiKey } from '../lib/auth.js';
import { apiRequest, uploadFile } from '../lib/api.js';
import { createTarball } from '../lib/tar.js';
import { createSpinner } from '../lib/spinner.js';

export async function preview(flags) {
  const apiKey = requireApiKey();
  const config = readConfig();
  const appName = config.name || config.app_id;

  console.log(`\n  Creating preview for ${appName}\n`);

  // Build
  if (config.build?.command) {
    const spinner = createSpinner('Building').start();
    try {
      execSync(config.build.command, {
        cwd: process.cwd(),
        stdio: 'pipe',
        env: { ...process.env, NODE_ENV: 'production' },
      });
      spinner.succeed('Built successfully');
    } catch (err) {
      spinner.fail('Build failed');
      console.error(`\n${err.stderr?.toString() || err.message}\n`);
      process.exit(1);
    }
  }

  // Archive
  const archiveSpinner = createSpinner('Creating archive').start();
  const tarball = createTarball(process.cwd(), config.ignore);
  archiveSpinner.succeed(`Archive created (${tarball.sizeFormatted})`);

  // Upload via Deno function
  const uploadSpinner = createSpinner('Uploading').start();
  const uploadResult = await uploadFile(apiKey, tarball.buffer, `${appName}-preview.tar.gz`);
  uploadSpinner.succeed(`Uploaded (${tarball.sizeFormatted})`);

  // Deploy preview via Deno function
  const deploySpinner = createSpinner('Creating preview').start();
  const result = await apiRequest('/cli/preview', {
    apiKey,
    body: {
      app_name: appName,
      upload_url: uploadResult.upload_url,
    },
  });
  deploySpinner.succeed('Preview ready');

  console.log(`
  Preview:    ${result.preview_url}
  Expires in: ${result.expires_in || '2 hours'}
`);
}
