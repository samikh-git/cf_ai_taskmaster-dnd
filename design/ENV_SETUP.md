# Environment Variables Setup for Cloudflare Workers

## Overview

For Cloudflare Workers, **secrets** (sensitive data like API keys, tokens) should be set using the `wrangler secret put` command or the Cloudflare Dashboard. These are encrypted and never stored in your codebase.

**Non-sensitive configuration** can be set in `wrangler.jsonc` under the `vars` key, but this is not recommended for secrets.

## Required Environment Variables

### Agent Worker (`agent/`)

**Secrets:**
- `AUTH_SECRET` - Secret for validating authentication tokens (should match `NEXTAUTH_SECRET`)

### Frontend Worker (`frontend/`)

**Secrets:**
- `GITHUB_CLIENT_ID` - GitHub OAuth App Client ID
- `GITHUB_CLIENT_SECRET` - GitHub OAuth App Client Secret
- `NEXTAUTH_SECRET` - NextAuth.js secret for session encryption
- `AUTH_SECRET` - Secret for validating authentication tokens (should match `NEXTAUTH_SECRET`)

**Optional (has defaults):**
- `AGENT_URL` - URL of the agent worker (defaults to `https://agent.sami-houssaini.workers.dev` in production)
- `NODE_ENV` - Automatically set by Cloudflare

## Setting Secrets via CLI (Recommended)

### For Agent Worker

```bash
cd agent
wrangler secret put AUTH_SECRET
# Enter the secret value when prompted
```

### For Frontend Worker

```bash
cd frontend
wrangler secret put GITHUB_CLIENT_ID
wrangler secret put GITHUB_CLIENT_SECRET
wrangler secret put NEXTAUTH_SECRET
wrangler secret put AUTH_SECRET
# Enter each secret value when prompted
```

**Note:** `AUTH_SECRET` and `NEXTAUTH_SECRET` should be the **same value** for both workers to ensure authentication works correctly.

## Setting Secrets via Cloudflare Dashboard

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Select your account
3. Go to **Workers & Pages**
4. Click on your worker (either `agent` or `frontend`)
5. Go to **Settings** → **Variables and Secrets**
6. Under **Secrets**, click **Add secret**
7. Enter the secret name and value
8. Click **Save**

## Setting Non-Sensitive Variables in `wrangler.jsonc`

For non-sensitive configuration, you can add a `vars` section to `wrangler.jsonc`:

```jsonc
{
  "name": "agent",
  // ... other config ...
  "vars": {
    "AGENT_URL": "https://agent.sami-houssaini.workers.dev"
  }
}
```

**⚠️ Warning:** Never commit secrets to `wrangler.jsonc` or any file in your repository!

## Local Development

For local development, use `.dev.vars` files (already in `.gitignore`):

**`agent/.dev.vars`:**
```
AUTH_SECRET=your-secret-here
```

**`frontend/.dev.vars`:**
```
GITHUB_CLIENT_ID=your-client-id
GITHUB_CLIENT_SECRET=your-client-secret
NEXTAUTH_SECRET=your-nextauth-secret
AUTH_SECRET=your-auth-secret
```

## Verifying Secrets

To verify secrets are set correctly:

```bash
# List secrets (names only, not values)
wrangler secret list
```

## Important Notes

1. **Secrets are encrypted** and stored securely by Cloudflare
2. **Secrets are environment-specific** - set them for each environment (production, staging, etc.)
3. **Secrets cannot be read back** - once set, you can only update or delete them
4. **Use the same `AUTH_SECRET` and `NEXTAUTH_SECRET`** in both workers for authentication to work
5. **`.dev.vars` files are for local development only** and are already in `.gitignore`

## Generating Secure Secrets

You can generate secure random secrets using:

```bash
# Generate a random 32-character secret
openssl rand -base64 32

# Or using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Use the same generated secret for both `NEXTAUTH_SECRET` and `AUTH_SECRET`.

