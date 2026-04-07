/**
 * nom setup — Generate AI tool config files for every major IDE/agent.
 *
 * Creates:
 *   .cursor/rules/nometria.mdc     — Cursor AI rules
 *   .clinerules                     — Cline / Roo Code
 *   .windsurfrules                  — Windsurf (Codeium)
 *   .github/copilot-instructions.md — GitHub Copilot
 *   .github/workflows/nometria-deploy.yml — Auto-deploy on push
 *   CLAUDE.md                       — Claude Code project instructions
 *   AGENTS.md                       — Universal agent deployment guide
 *   .claude/commands/deploy.md      — Claude Code /deploy slash command
 *   .claude/commands/preview.md     — Claude Code /preview slash command
 *   .claude/commands/status.md      — Claude Code /status slash command
 *   .claude/commands/nometria-login.md — Claude Code /nometria-login slash command
 *   .continue/config.json           — Continue.dev MCP config
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export async function setup(flags) {
  const dir = process.cwd();

  // Read nometria.json if it exists
  let config = { name: 'my-app', platform: 'aws', region: 'us-east-1' };
  const configPath = join(dir, 'nometria.json');
  if (existsSync(configPath)) {
    try {
      config = { ...config, ...JSON.parse(readFileSync(configPath, 'utf8')) };
    } catch { /* use defaults */ }
  }

  const appName = config.name || 'my-app';
  const platform = config.platform || 'aws';

  console.log('\n  Setting up AI tool integrations for Nometria\n');

  const files = [];

  // 1. Cursor rules
  const cursorDir = join(dir, '.cursor', 'rules');
  mkdirSync(cursorDir, { recursive: true });
  writeFileSync(join(cursorDir, 'nometria.mdc'), cursorRules(appName, platform));
  files.push('.cursor/rules/nometria.mdc');

  // 2. Cline rules
  writeFileSync(join(dir, '.clinerules'), clineRules(appName, platform));
  files.push('.clinerules');

  // 3. Windsurf rules
  writeFileSync(join(dir, '.windsurfrules'), windsurfRules(appName, platform));
  files.push('.windsurfrules');

  // 4. GitHub Copilot instructions
  const githubDir = join(dir, '.github');
  mkdirSync(githubDir, { recursive: true });
  writeFileSync(join(githubDir, 'copilot-instructions.md'), copilotInstructions(appName, platform));
  files.push('.github/copilot-instructions.md');

  // 5. GitHub Action for auto-deploy
  const workflowDir = join(dir, '.github', 'workflows');
  mkdirSync(workflowDir, { recursive: true });
  writeFileSync(join(workflowDir, 'nometria-deploy.yml'), deployAction(appName));
  files.push('.github/workflows/nometria-deploy.yml');

  // 6. CLAUDE.md
  writeFileSync(join(dir, 'CLAUDE.md'), claudeMd(appName, platform));
  files.push('CLAUDE.md');

  // 7. AGENTS.md — universal agent guide
  writeFileSync(join(dir, 'AGENTS.md'), agentsMd(appName, platform));
  files.push('AGENTS.md');

  // 8. Claude Code slash commands
  const claudeCommandsDir = join(dir, '.claude', 'commands');
  mkdirSync(claudeCommandsDir, { recursive: true });
  writeFileSync(join(claudeCommandsDir, 'deploy.md'), claudeCommandDeploy());
  files.push('.claude/commands/deploy.md');
  writeFileSync(join(claudeCommandsDir, 'preview.md'), claudeCommandPreview());
  files.push('.claude/commands/preview.md');
  writeFileSync(join(claudeCommandsDir, 'status.md'), claudeCommandStatus());
  files.push('.claude/commands/status.md');
  writeFileSync(join(claudeCommandsDir, 'nometria-login.md'), claudeCommandLogin());
  files.push('.claude/commands/nometria-login.md');

  // 9. Continue.dev config
  const continueDir = join(dir, '.continue');
  mkdirSync(continueDir, { recursive: true });
  const continueConfigPath = join(continueDir, 'config.json');
  writeContinueConfig(continueConfigPath);
  files.push('.continue/config.json');

  // 10. Claude Code automation hooks
  const hooksDir = join(dir, '.claude', 'hooks');
  mkdirSync(hooksDir, { recursive: true });
  writeFileSync(join(hooksDir, 'auto-deploy-on-commit.sh'), autoDeployHook(), { mode: 0o755 });
  files.push('.claude/hooks/auto-deploy-on-commit.sh');
  writeFileSync(join(hooksDir, 'security-gate.sh'), securityGateHook(), { mode: 0o755 });
  files.push('.claude/hooks/security-gate.sh');
  writeFileSync(join(hooksDir, 'cost-guardian.sh'), costGuardianHook(), { mode: 0o755 });
  files.push('.claude/hooks/cost-guardian.sh');

  // Print results
  for (const f of files) {
    console.log(`    ${f}`);
  }

  console.log(`
  All AI tools now know how to deploy this project with Nometria.

  Works with: Cursor, Claude Code, Cline, Windsurf, GitHub Copilot,
              Continue.dev, Aider, and any MCP-compatible tool.

  Claude Code users can now type:
    /deploy            Deploy to production
    /preview           Staging preview (free, 2hr)
    /status            Check deployment status
    /logs              View deployment logs
    /env               Manage environment variables
    /domain            Add custom domains
    /nometria-login    Set up authentication

  Automation hooks installed:
    auto-deploy-on-commit.sh   Auto-resync on git commit
    security-gate.sh           Block deploys with low security score
    cost-guardian.sh            Warn about idle running instances
`);
}

// ─── Templates ──────────────────────────────────────────────────────────────

function cursorRules(appName, platform) {
  return `---
description: Nometria deployment rules for ${appName}
globs: ["**/*"]
alwaysApply: true
---

# Nometria Deployment

This project deploys via **Nometria** (\`nom\` CLI). Configuration is in \`nometria.json\`.

## Deployment Commands

| Command | Description |
|---------|-------------|
| \`nom deploy\` | Deploy to production (${platform}) |
| \`nom preview\` | Create staging preview (free, 2hr) |
| \`nom status\` | Check deployment status |
| \`nom logs -f\` | Stream live logs |
| \`nom github connect\` | Connect GitHub for auto-deploy |

## Rules

1. When the user asks to deploy, run \`nom deploy\` in the terminal
2. When the user asks for a preview, run \`nom preview\`
3. For deployment status, run \`nom status\`
4. Environment variables are managed via \`nom env set KEY=VALUE\`
5. Never call the Nometria Python API directly — use the \`nom\` CLI
6. The deployment config is in \`nometria.json\` — do not modify it without asking
7. If not authenticated, run \`nom login\` first (opens browser)

## Quick Reference

- App: ${appName}
- Platform: ${platform}
- Config: \`nometria.json\`
- Docs: https://docs.nometria.com
`;
}

function clineRules(appName, platform) {
  return `# Nometria Deployment Rules

This project (${appName}) deploys via Nometria.

## How to Deploy

1. Run \`nom deploy\` to deploy to production (${platform})
2. Run \`nom preview\` for a staging preview (free, 2 hours)
3. Run \`nom status\` to check deployment status
4. Run \`nom logs -f\` to stream live logs

## Important

- Configuration is in \`nometria.json\` — read it before making deployment decisions
- If not authenticated, run \`nom login\` (opens browser for sign-in)
- Environment variables: \`nom env set KEY=VALUE\` / \`nom env list\`
- Custom domains: \`nom domain add yourdomain.com\`
- Instance management: \`nom start\`, \`nom stop\`, \`nom upgrade 8gb\`
- GitHub auto-deploy: \`nom github connect\`
- Security scan: \`nom scan\`
- Never call backend APIs directly — always use the \`nom\` CLI
- The MCP server \`@nometria-ai/claude-code\` is also available for tool-based access
`;
}

function windsurfRules(appName, platform) {
  return `# Nometria Deployment

This project (${appName}) deploys to ${platform} via Nometria.

## Commands

Deploy: \`nom deploy\`
Preview: \`nom preview\` (free, 2hr expiry)
Status: \`nom status\`
Logs: \`nom logs -f\`
Login: \`nom login\` (opens browser)
GitHub: \`nom github connect\` (auto-deploy on push)
Env vars: \`nom env set KEY=VALUE\`
Scan: \`nom scan\`
Instance: \`nom start\` / \`nom stop\` / \`nom upgrade <size>\`
Domain: \`nom domain add yourdomain.com\`

## Config

Deployment configuration is in \`nometria.json\`. Do not modify without asking the user.

## Rules

- Always use the \`nom\` CLI for deployment operations
- Never call Nometria APIs directly
- If the user is not authenticated, run \`nom login\` first
- Check \`nom status\` before deploying to see current state
`;
}

function copilotInstructions(appName, platform) {
  return `# Nometria Deployment

This project (**${appName}**) deploys to **${platform}** using Nometria.

## Deployment

- Deploy: \`nom deploy\`
- Preview: \`nom preview\` (free staging URL, expires in 2 hours)
- Status: \`nom status\`
- Logs: \`nom logs -f\`

## Setup

- Config: \`nometria.json\`
- Login: \`nom login\` (opens browser for authentication)
- GitHub auto-deploy: \`nom github connect\`

## Management

- Environment variables: \`nom env set KEY=VALUE\` / \`nom env list\`
- Custom domain: \`nom domain add yourdomain.com\`
- Instance control: \`nom start\` / \`nom stop\` / \`nom upgrade 8gb\`
- Security scan: \`nom scan\`

## Notes

- Always use the \`nom\` CLI — do not call Nometria APIs directly
- Read \`nometria.json\` for current deployment configuration
- Install: \`npm i -g @nometria-ai/nom\` or use \`npx @nometria-ai/nom\`
`;
}

function claudeMd(appName, platform) {
  return `# ${appName}

This project deploys via **Nometria** to **${platform}**.

## Deployment

\`\`\`bash
nom deploy          # Deploy to production
nom preview         # Staging preview (free, 2hr)
nom status          # Check status
nom logs -f         # Stream logs
\`\`\`

## Config

Deployment configuration is in \`nometria.json\`. Read it before making deployment decisions.

## Full CLI Reference

| Command | Description |
|---------|-------------|
| \`nom login\` | Sign in via browser |
| \`nom deploy\` | Deploy to production |
| \`nom preview\` | Staging preview |
| \`nom status\` | Deployment status |
| \`nom logs [-f]\` | View/stream logs |
| \`nom github connect\` | GitHub OAuth for auto-deploy |
| \`nom github push -m "msg"\` | Push to GitHub |
| \`nom start\` / \`nom stop\` | Instance control |
| \`nom upgrade <size>\` | Resize (2gb/4gb/8gb/16gb) |
| \`nom domain add <domain>\` | Custom domain |
| \`nom env set KEY=VALUE\` | Set env var |
| \`nom env list\` | List env vars |
| \`nom scan\` | AI security scan |
| \`nom setup\` | Regenerate AI tool configs |

## MCP Server

For tool-based access: \`claude mcp add nometria -- npx @nometria-ai/claude-code\`

## Rules

- Use the \`nom\` CLI for all deployment operations
- Never call backend APIs directly
- If unauthenticated, run \`nom login\` first
`;
}

function deployAction(appName) {
  return `name: Deploy to Nometria

on:
  push:
    branches: [main]
  workflow_dispatch:

concurrency:
  group: nometria-deploy
  cancel-in-progress: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Run security scan
        run: npx @nometria-ai/nom scan || echo "Scan completed with warnings"
        env:
          NOMETRIA_API_KEY: \${{ secrets.NOMETRIA_API_KEY }}

      - name: Deploy to production
        id: deploy
        run: npx @nometria-ai/nom deploy --yes
        env:
          NOMETRIA_API_KEY: \${{ secrets.NOMETRIA_API_KEY }}

      - name: Verify deployment
        if: success()
        run: |
          echo "Deployment successful"
          npx @nometria-ai/nom status --json || true
        env:
          NOMETRIA_API_KEY: \${{ secrets.NOMETRIA_API_KEY }}

      - name: Notify on failure
        if: failure()
        run: |
          echo "::error::Deployment failed. Check logs: npx @nometria-ai/nom logs"
          echo "Dashboard: https://nometria.com/dashboard"
`;
}

// ─── Claude Code Slash Commands ─────────────────────────────────────────────

function claudeCommandDeploy() {
  return `---
allowed-tools: Bash(curl:*), Bash(cat:*), Bash(sleep:*), Bash(echo:*), Bash(grep:*), Read, Write
description: Deploy your app to production via Nometria
argument-hint: Optional app name or migration ID
---

# Deploy to Production

You are deploying the user's app to production via the Nometria platform. Execute this workflow precisely.

## Step 1: Resolve API token

Find the Nometria API token. Check in this order:

\`\`\`bash
# 1. Environment variables (API key or JWT token)
echo "$NOMETRIA_API_KEY"
echo "$NOMETRIA_TOKEN"

# 2. .env file in current project
grep -s 'NOMETRIA_API_KEY\\|NOMETRIA_TOKEN' .env .env.local 2>/dev/null

# 3. Stored credentials from \\\`nom login\\\`
cat ~/.nometria/credentials.json 2>/dev/null

# 4. Home directory config (legacy)
cat ~/.nometria 2>/dev/null
\`\`\`

If no token is found, tell the user:

> No Nometria API token found. Run \\\`nom login\\\` or \\\`/nometria-login\\\` to authenticate.
> Get your API key at https://nometria.com/settings/api-keys

**Stop here if no token.** Do not proceed without a valid token.

Store the token: \\\`TOKEN="<the token>"\\\`

## Step 2: Identify the app

Check if there's a \\\`nometria.json\\\` in the workspace root:
\`\`\`bash
cat nometria.json 2>/dev/null
\`\`\`

If it exists, extract \\\`app_id\\\` and \\\`migration_id\\\` from it.

If not, or if the user specified an app name as \\\`$ARGUMENTS\\\`, list all migrations:

\`\`\`bash
curl -s -X POST https://app.nometria.com/listUserMigrations \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $TOKEN" \\
  -d '{}'
\`\`\`

From the response, find the matching migration. If multiple apps exist and the user didn't specify which one, show a numbered list and ask them to pick.

Only proceed with migrations that have \\\`delivery_type: "hosting"\\\` and \\\`payment_status: "paid"\\\`.

Store: \\\`APP_ID="<app_id>"\\\` and \\\`MIGRATION_ID="<migration_id>"\\\`

## Step 3: Check current deployment status

\`\`\`bash
curl -s -X POST https://app.nometria.com/checkAwsStatus \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $TOKEN" \\
  -d "{\\"app_id\\": \\"$APP_ID\\"}"
\`\`\`

Parse the response to determine the instance state.

## Step 4: Deploy or resync

**If instance is running** (\\\`data.instanceState === "running"\\\`):

Tell the user: "App is already running. Resyncing code to production..."

\`\`\`bash
curl -s -X POST https://app.nometria.com/resyncHosting \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $TOKEN" \\
  -d "{\\"app_id\\": \\"$APP_ID\\"}"
\`\`\`

**If instance is stopped** (\\\`data.instanceState === "stopped"\\\`):

Tell the user: "Instance is stopped. Starting and resyncing..."

\`\`\`bash
curl -s -X POST https://app.nometria.com/updateInstanceState \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $TOKEN" \\
  -d "{\\"app_id\\": \\"$APP_ID\\", \\"instance_state\\": \\"start\\"}"
\`\`\`

Then resync once it's running.

**If not deployed** (\\\`status === "not_deployed"\\\`):

Tell the user: "Deploying new production instance..."

\`\`\`bash
curl -s -X POST https://app.nometria.com/deployToAws \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $TOKEN" \\
  -d "{\\"migration_id\\": \\"$MIGRATION_ID\\"}"
\`\`\`

## Step 5: Poll for completion

Poll every 5 seconds until the deployment reaches a terminal state:

\`\`\`bash
curl -s -X POST https://app.nometria.com/checkAwsStatus \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $TOKEN" \\
  -d "{\\"app_id\\": \\"$APP_ID\\"}"
\`\`\`

Terminal states:
- \\\`instanceState: "running"\\\` -> **Success**
- \\\`deploymentStatus: "failed"\\\` -> **Failure** (report \\\`errorMessage\\\`)
- \\\`instanceState: "terminated"\\\` -> **Failure**

Poll up to 60 times (5 minutes). Report progress every 3 polls.

## Step 6: Report result

**On success**, display:

\`\`\`
Deployed successfully!

   App:  <app_name>
   URL:  <deployUrl or hosted_url>
   IP:   <ipAddress>
   Type: <instanceType>
\`\`\`

**On failure**, display the error and suggest checking the Nometria dashboard.

## Step 7: Save workspace config

If \\\`nometria.json\\\` doesn't exist, create it so future deploys are faster:

\`\`\`json
{
  "app_id": "<APP_ID>",
  "migration_id": "<MIGRATION_ID>",
  "app_name": "<app_name>",
  "api_url": "https://app.nometria.com"
}
\`\`\`

Do all of the above. Execute every curl call and report results to the user.
`;
}

function claudeCommandPreview() {
  return `---
allowed-tools: Bash(curl:*), Bash(cat:*), Bash(grep:*), Bash(echo:*), Read
description: Deploy a staging preview of your app via Nometria
argument-hint: Optional app name
---

# Deploy Staging Preview

You are creating a temporary staging preview of the user's app. This is free and creates a short-lived URL.

## Step 1: Resolve token

\`\`\`bash
TOKEN="\${NOMETRIA_API_KEY:-\${NOMETRIA_TOKEN:-$(grep -s 'NOMETRIA_API_KEY\\|NOMETRIA_TOKEN' .env .env.local 2>/dev/null | head -1 | cut -d= -f2- | tr -d ' "'"'"'')}}"
echo "Token found: $([ -n "$TOKEN" ] && echo 'yes' || echo 'no')"
\`\`\`

If no token: tell the user to run \\\`nom login\\\` or \\\`/nometria-login\\\` and stop.

## Step 2: Identify the app

\`\`\`bash
# Try workspace config first
cat nometria.json 2>/dev/null
\`\`\`

If no \\\`nometria.json\\\`, list migrations:

\`\`\`bash
curl -s -X POST https://app.nometria.com/listUserMigrations \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $TOKEN" \\
  -d '{}'
\`\`\`

Pick the correct migration. If \\\`$ARGUMENTS\\\` was provided, match by app name. Otherwise, if multiple exist, ask the user. Store \\\`MIGRATION_ID\\\`.

## Step 3: Deploy preview

\`\`\`bash
curl -s -X POST https://app.nometria.com/deployStagingPreview \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $TOKEN" \\
  -d "{\\"migration_id\\": \\"$MIGRATION_ID\\", \\"production\\": false}"
\`\`\`

## Step 4: Report result

Parse the response. On success, display:

\`\`\`
Preview deployed!

   URL: <preview_url>
   Expires: ~2 hours

   This is a temporary preview. Use /deploy for production.
\`\`\`

On failure, show the error message and suggest checking the dashboard.

Execute all curl commands and report the results.
`;
}

function claudeCommandStatus() {
  return `---
allowed-tools: Bash(curl:*), Bash(cat:*), Bash(grep:*), Bash(echo:*), Read
description: Check deployment status of your Nometria apps
argument-hint: Optional app name to filter
---

# Check Deployment Status

Show the user the current state of their Nometria deployments.

## Step 1: Resolve token

\`\`\`bash
TOKEN="\${NOMETRIA_API_KEY:-\${NOMETRIA_TOKEN:-$(grep -s 'NOMETRIA_API_KEY\\|NOMETRIA_TOKEN' .env .env.local 2>/dev/null | head -1 | cut -d= -f2- | tr -d ' "'"'"'')}}"
\`\`\`

If no token: tell the user to run \\\`/nometria-login\\\` and stop.

## Step 2: List all migrations

\`\`\`bash
curl -s -X POST https://app.nometria.com/listUserMigrations \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $TOKEN" \\
  -d '{}'
\`\`\`

## Step 3: Check AWS status for hosting apps

For each migration with \\\`delivery_type: "hosting"\\\`, check its status:

\`\`\`bash
curl -s -X POST https://app.nometria.com/checkAwsStatus \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $TOKEN" \\
  -d "{\\"app_id\\": \\"<APP_ID>\\"}"
\`\`\`

## Step 4: Display formatted table

Present results as a clear table showing App, Platform, Status, URL, and Instance.

Use these status indicators:
- running — app is live
- deploying / launching — deployment in progress
- stopped — instance exists but is off
- failed — deployment failed (show error if available)
- none — not deployed to hosting

If \\\`$ARGUMENTS\\\` was provided, filter the results to match that app name.

Also show totals: Total apps, Running, Stopped.

If there's a \\\`nometria.json\\\` in the workspace, highlight the linked app.

Execute all the curl calls and display the results.
`;
}

function claudeCommandLogin() {
  return `---
allowed-tools: Bash(echo:*), Bash(cat:*), Bash(grep:*), Read, Write
description: Authenticate with the Nometria deployment platform
---

# Nometria Login

Help the user set up their Nometria API token for deployments.

## Step 1: Check existing token

\`\`\`bash
# Check environment (API key or JWT)
echo "API_KEY: $([ -n "$NOMETRIA_API_KEY" ] && echo 'set' || echo 'not set')"
echo "TOKEN: $([ -n "$NOMETRIA_TOKEN" ] && echo 'set' || echo 'not set')"

# Check .env
grep -s 'NOMETRIA_API_KEY\\|NOMETRIA_TOKEN' .env .env.local 2>/dev/null && echo "Found in .env" || echo ".env: not found"

# Check nom CLI credentials
cat ~/.nometria/credentials.json 2>/dev/null && echo "Found ~/.nometria/credentials.json" || echo "~/.nometria/credentials.json: not found"
\`\`\`

If a token already exists, tell the user they're already authenticated and show which source it was found in. Ask if they want to update it.

## Step 2: Get the token

Tell the user:

> To get your Nometria API key:
>
> 1. Go to **https://nometria.com/settings/api-keys**
> 2. Sign in to your account
> 3. Click **Generate New Key**
> 4. Copy the key and paste it here
>
> Your key is stored locally and never sent anywhere except the Nometria API.
> Alternatively, you can use \\\`nom login\\\` from the CLI.

Wait for the user to provide the token. They will paste it in the chat.

## Step 3: Validate the token

Once the user provides a token, validate it:

\`\`\`bash
curl -s -X POST https://app.nometria.com/listUserMigrations \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <USER_TOKEN>" \\
  -d '{}'
\`\`\`

If the response contains \\\`"success": true\\\`, the token is valid.

## Step 4: Store the token

If the current directory has a \\\`.env\\\` file, append \\\`NOMETRIA_API_KEY=<key>\\\` to it.
If no \\\`.env\\\` exists, create \\\`.env\\\` with the key.
Warn the user if \\\`.env\\\` is not in \\\`.gitignore\\\`.

## Step 5: Confirm

Tell the user they're authenticated and show available commands:
  /deploy   - Deploy to production
  /preview  - Deploy staging preview
  /status   - Check deployment status
  nom deploy - Deploy from CLI
`;
}

// ─── AGENTS.md ──────────────────────────────────────────────────────────────

function agentsMd(appName, platform) {
  return `# Nometria Agent Deployment Guide

> Deploy any app to any cloud from your IDE, CLI, or AI agent. Works with VS Code, Cursor, Claude Code, and any tool that can run \\\`curl\\\` or \\\`npx\\\`.

## Quick Start — CLI (recommended)

\`\`\`bash
# Install and deploy in seconds
npx @nometria-ai/nom login
npx @nometria-ai/nom init
npx @nometria-ai/nom deploy
\`\`\`

## Quick Start — curl (for AI agents)

\`\`\`bash
# 1. Set your token (API key or JWT)
export NOMETRIA_API_KEY="nometria_sk_..."  # from https://nometria.com/settings/api-keys

# 2. List your apps
curl -s -X POST https://app.nometria.com/listUserMigrations \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $NOMETRIA_API_KEY" -d '{}'

# 3. Deploy to production (resync if already running)
curl -s -X POST https://app.nometria.com/resyncHosting \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $NOMETRIA_API_KEY" \\
  -d '{"app_id": "YOUR_APP_ID"}'
\`\`\`

---

## Developer Surfaces

| Surface | Install | Auth |
|---------|---------|------|
| **nom CLI** | \\\`npx @nometria-ai/nom\\\` | API key (\\\`NOMETRIA_API_KEY\\\`) |
| **VS Code/Cursor** | Extensions marketplace | OAuth login |
| **Claude Code** | \\\`/deploy\\\`, \\\`/preview\\\`, \\\`/status\\\` | API key or JWT |
| **Any AI agent** | curl | API key or JWT |

---

## Authentication

Every API call requires \\\`Authorization: Bearer <token>\\\` header. Both API keys (\\\`nometria_sk_...\\\`) and JWT tokens are accepted.

**Getting an API key:**
1. Sign in at https://nometria.com/settings/api-keys
2. Go to Settings -> API Token
3. Copy and store as \\\`NOMETRIA_API_KEY\\\` environment variable

**Base URL:** \\\`https://app.nometria.com\\\`

All endpoints are \\\`POST\\\` with JSON body and \\\`Content-Type: application/json\\\`.

---

## API Reference

### List Apps
\\\`POST /listUserMigrations\\\` — Returns all migrations with app_id, status, delivery_type, hosted_url

### Check Status
\\\`POST /checkAwsStatus\\\` — Body: \\\`{"app_id": "..."}\\\` — Returns instanceState, deploymentStatus, ipAddress, deployUrl

### Deploy New Instance
\\\`POST /deployToAws\\\` — Body: \\\`{"migration_id": "..."}\\\` — Creates new EC2 instance. Poll checkAwsStatus every 5s.

### Resync Running App
\\\`POST /resyncHosting\\\` — Body: \\\`{"app_id": "..."}\\\` — Syncs latest code to running instance.

### Staging Preview
\\\`POST /deployStagingPreview\\\` — Body: \\\`{"migration_id": "...", "production": false}\\\` — Free, 2hr preview.

### Instance Control
\\\`POST /updateInstanceState\\\` — Body: \\\`{"app_id": "...", "instance_state": "start|stop|terminate"}\\\`

### Upgrade Instance
\\\`POST /upgradeInstance\\\` — Body: \\\`{"app_id": "...", "instance_type": "2gb|4gb|8gb|16gb"}\\\`

### Environment Variables
\\\`POST /setEnvVars\\\` — Body: \\\`{"app_id": "...", "env_vars": {"KEY": "value"}}\\\`

### Custom Domain
\\\`POST /addCustomDomain\\\` — Body: \\\`{"app_id": "...", "custom_domain": "app.yourdomain.com"}\\\`

### AI Security Scan
\\\`POST /runAiScan\\\` — Body: \\\`{"app_id": "...", "migration_id": "..."}\\\`

---

## Decision Logic for Agents

When the user says "deploy":

\\\`\\\`\\\`
Is there a nometria.json?
  YES -> Use its app_id/migration_id
  NO  -> POST /listUserMigrations, pick the right one

POST /checkAwsStatus with app_id
  instanceState === "running"?
    YES -> POST /resyncHosting (fast code sync)
  instanceState === "stopped"?
    YES -> POST /updateInstanceState (start), then resyncHosting
  status === "not_deployed"?
    YES -> POST /deployToAws (new instance, takes 2-5 min)

Poll /checkAwsStatus every 5s until terminal state
Report URL to user
\\\`\\\`\\\`

---

## Configuration (\\\`nometria.json\\\`)

\\\`\\\`\\\`json
{
  "name": "${appName}",
  "framework": "vite",
  "platform": "${platform}",
  "region": "us-east-1",
  "instanceType": "4gb",
  "build": { "command": "npm run build", "output": "dist" }
}
\\\`\\\`\\\`

---

## IDE & CLI Integration

| Tool | Integration |
|------|-------------|
| **nom CLI** | \\\`npx @nometria-ai/nom deploy\\\` — deploy from terminal |
| **Claude Code** | Slash commands: \\\`/deploy\\\`, \\\`/preview\\\`, \\\`/status\\\`, \\\`/nometria-login\\\` |
| **Cursor** | Auto-rules in \\\`.cursor/rules/nometria.mdc\\\` |
| **VS Code / Cursor** | Extension: search "Nometria" in marketplace |
| **Any agent** | Read this file and use the curl commands above |
`;
}

function writeContinueConfig(configPath) {
  let config = {};
  if (existsSync(configPath)) {
    try {
      config = JSON.parse(readFileSync(configPath, 'utf8'));
    } catch { /* start fresh */ }
  }

  // Add/update MCP server config
  if (!config.experimental) config.experimental = {};
  if (!config.experimental.modelContextProtocolServers) config.experimental.modelContextProtocolServers = [];

  const servers = config.experimental.modelContextProtocolServers;
  const existing = servers.findIndex(s => s.name === 'nometria');
  const nometriaServer = {
    name: 'nometria',
    command: 'npx',
    args: ['@nometria-ai/claude-code'],
  };

  if (existing >= 0) {
    servers[existing] = nometriaServer;
  } else {
    servers.push(nometriaServer);
  }

  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
}

// ─── Automation Hook Templates ─────────────────────────────────────────────

function autoDeployHook() {
  return `#!/usr/bin/env bash
# Nometria: Auto-deploy on git commit
# Triggers resync when a git commit is made in a Nometria project.
set -euo pipefail

TOOL_INPUT="\${CLAUDE_TOOL_INPUT:-}"
if ! echo "$TOOL_INPUT" | grep -q "git commit"; then exit 0; fi
if [ ! -f "nometria.json" ]; then exit 0; fi

APP_ID=$(grep -o '"app_id"[[:space:]]*:[[:space:]]*"[^"]*"' nometria.json 2>/dev/null | head -1 | cut -d'"' -f4)
[ -z "$APP_ID" ] && exit 0

TOKEN="\${NOMETRIA_API_KEY:-\${NOMETRIA_TOKEN:-}}"
[ -z "$TOKEN" ] && [ -f .env ] && TOKEN=$(grep -s 'NOMETRIA_API_KEY\\|NOMETRIA_TOKEN' .env 2>/dev/null | head -1 | cut -d= -f2- | tr -d ' "'"'"'')
[ -z "$TOKEN" ] && [ -f "$HOME/.nometria/credentials.json" ] && TOKEN=$(grep -o '"api_key"[[:space:]]*:[[:space:]]*"[^"]*"' "$HOME/.nometria/credentials.json" 2>/dev/null | head -1 | cut -d'"' -f4)
[ -z "$TOKEN" ] && exit 0

curl -sf -X POST https://app.nometria.com/resyncHosting \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $TOKEN" \\
  -d "{\\"app_id\\": \\"$APP_ID\\"}" > /dev/null 2>&1 &

echo "Nometria: resyncing $APP_ID in background..."
`;
}

function securityGateHook() {
  return `#!/usr/bin/env bash
# Nometria: Security gate before deploy
# Blocks production deploys if security score < 70.
set -euo pipefail

TOOL_NAME="\${CLAUDE_TOOL_NAME:-}"
TOOL_INPUT="\${CLAUDE_TOOL_INPUT:-}"

IS_DEPLOY=false
[ "$TOOL_NAME" = "Skill" ] && echo "$TOOL_INPUT" | grep -q '"deploy"' && IS_DEPLOY=true
[ "$TOOL_NAME" = "Bash" ] && echo "$TOOL_INPUT" | grep -qE "deployToAws|resyncHosting|nom deploy" && IS_DEPLOY=true
[ "$IS_DEPLOY" != "true" ] && exit 0
[ ! -f "nometria.json" ] && exit 0

APP_ID=$(grep -o '"app_id"[[:space:]]*:[[:space:]]*"[^"]*"' nometria.json 2>/dev/null | head -1 | cut -d'"' -f4)
MIGRATION_ID=$(grep -o '"migration_id"[[:space:]]*:[[:space:]]*"[^"]*"' nometria.json 2>/dev/null | head -1 | cut -d'"' -f4)
[ -z "$APP_ID" ] || [ -z "$MIGRATION_ID" ] && exit 0

TOKEN="\${NOMETRIA_API_KEY:-\${NOMETRIA_TOKEN:-}}"
[ -z "$TOKEN" ] && [ -f .env ] && TOKEN=$(grep -s 'NOMETRIA_API_KEY\\|NOMETRIA_TOKEN' .env 2>/dev/null | head -1 | cut -d= -f2- | tr -d ' "'"'"'')
[ -z "$TOKEN" ] && [ -f "$HOME/.nometria/credentials.json" ] && TOKEN=$(grep -o '"api_key"[[:space:]]*:[[:space:]]*"[^"]*"' "$HOME/.nometria/credentials.json" 2>/dev/null | head -1 | cut -d'"' -f4)
[ -z "$TOKEN" ] && exit 0

echo "Nometria: running security scan before deploy..."
SCAN_RESULT=$(curl -sf -X POST https://app.nometria.com/runAiScan \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $TOKEN" \\
  -d "{\\"app_id\\": \\"$APP_ID\\", \\"migration_id\\": \\"$MIGRATION_ID\\"}" 2>/dev/null || echo '{}')

SCORE=$(echo "$SCAN_RESULT" | grep -o '"securityScore"[[:space:]]*:[[:space:]]*[0-9]*' | grep -o '[0-9]*$')

if [ -n "$SCORE" ] && [ "$SCORE" -lt 70 ]; then
  echo "BLOCKED: Security score $SCORE/100 (minimum: 70). Run 'nom scan' for details."
  exit 2
fi
[ -n "$SCORE" ] && echo "Nometria: security score $SCORE/100 — passed."
`;
}

function costGuardianHook() {
  return `#!/usr/bin/env bash
# Nometria: Cost guardian — detect idle instances on session start
set -euo pipefail

TOKEN="\${NOMETRIA_API_KEY:-\${NOMETRIA_TOKEN:-}}"
[ -z "$TOKEN" ] && [ -f .env ] && TOKEN=$(grep -s 'NOMETRIA_API_KEY\\|NOMETRIA_TOKEN' .env 2>/dev/null | head -1 | cut -d= -f2- | tr -d ' "'"'"'')
[ -z "$TOKEN" ] && [ -f "$HOME/.nometria/credentials.json" ] && TOKEN=$(grep -o '"api_key"[[:space:]]*:[[:space:]]*"[^"]*"' "$HOME/.nometria/credentials.json" 2>/dev/null | head -1 | cut -d'"' -f4)
[ -z "$TOKEN" ] && exit 0

MIGRATIONS=$(curl -sf -X POST https://app.nometria.com/listUserMigrations \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $TOKEN" \\
  -d '{}' 2>/dev/null || echo '{}')

APP_IDS=$(echo "$MIGRATIONS" | grep -o '"app_id"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)
[ -z "$APP_IDS" ] && exit 0

RUNNING=0
for APP_ID in $APP_IDS; do
  STATUS=$(curl -sf -X POST https://app.nometria.com/checkAwsStatus \\
    -H "Content-Type: application/json" \\
    -H "Authorization: Bearer $TOKEN" \\
    -d "{\\"app_id\\": \\"$APP_ID\\"}" 2>/dev/null || echo '{}')
  STATE=$(echo "$STATUS" | grep -o '"instanceState"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)
  [ "$STATE" = "running" ] && RUNNING=$((RUNNING + 1)) && echo "  Running: $APP_ID"
done

[ "$RUNNING" -gt 0 ] && echo "Nometria: $RUNNING running instance(s). Stop idle ones with: nom stop <app_id>"
`;
}
