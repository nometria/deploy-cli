# nom

Deploy any project to any cloud from your terminal. One command, zero config.

```bash
npx @nometria-ai/nom deploy
```

## Quick Start

```bash
# 1. Authenticate
npx @nometria-ai/nom login

# 2. Set up your project
npx @nometria-ai/nom init

# 3. Deploy
npx @nometria-ai/nom deploy
```

## Commands

| Command | Description |
|---------|-------------|
| `nom login` | Authenticate with your API key |
| `nom init` | Create a `nometria.json` config file |
| `nom deploy` | Deploy to production |
| `nom preview` | Create a staging preview |
| `nom status` | Check deployment status |
| `nom logs` | View deployment logs |
| `nom logs -f` | Stream logs in real-time |
| `nom whoami` | Show current authenticated user |

## Configuration

`nom init` creates a `nometria.json` in your project root:

```json
{
  "name": "my-app",
  "framework": "vite",
  "platform": "aws",
  "region": "us-east-1",
  "instanceType": "4gb",
  "build": {
    "command": "npm run build",
    "output": "dist"
  },
  "env": {
    "DATABASE_URL": "@env:DATABASE_URL"
  },
  "ignore": []
}
```

### Fields

| Field | Description | Default |
|-------|-------------|---------|
| `name` | Project name (becomes `{name}.nometria.com`) | from package.json |
| `framework` | `vite`, `nextjs`, `remix`, `static`, `node` | auto-detected |
| `platform` | `aws`, `gcp`, `azure`, `digitalocean`, `hetzner`, `vercel` | `aws` |
| `region` | Cloud region | `us-east-1` |
| `instanceType` | `2gb`, `4gb`, `8gb`, `16gb` | `4gb` |
| `build.command` | Build command | auto-detected |
| `build.output` | Build output directory | auto-detected |
| `env` | Environment variables. Use `@env:VAR` to read from local env | `{}` |
| `ignore` | Extra patterns to exclude from upload | `[]` |

## Authentication

Get an API key at [nometria.com/settings/api-keys](https://nometria.com/settings/api-keys).

```bash
# Option 1: Login command (stores in ~/.nometria/credentials.json)
nom login

# Option 2: Environment variable
export NOMETRIA_API_KEY=nometria_sk_...
```

## Environment Variables

Use the `@env:` prefix in `nometria.json` to reference local environment variables. These are resolved at deploy time and never stored in the config file:

```json
{
  "env": {
    "DATABASE_URL": "@env:DATABASE_URL",
    "API_SECRET": "@env:MY_API_SECRET"
  }
}
```

## Supported Platforms

- **AWS** (EC2 + Route53)
- **Google Cloud** (Compute Engine)
- **Azure** (Virtual Machines)
- **DigitalOcean** (Droplets)
- **Hetzner** (Cloud Servers)
- **Vercel** (Serverless)

## Requirements

- Node.js 18+
- `tar` command (available by default on macOS/Linux/WSL)

## License

MIT
