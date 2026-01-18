# Releasing

This document describes how to release a new version of `@emqx-ai/mcp-mqtt-sdk` to npm.

## How It Works

This project uses [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/) with OpenID Connect (OIDC) for secure, token-free publishing directly from GitHub Actions.

When a new git tag is pushed, GitHub Actions automatically:

1. Creates a GitHub Release
2. Runs lint and tests
3. Builds the project
4. Publishes to npm with provenance

## Publishing a New Version

Simply run:

```bash
# Patch release (0.2.6 -> 0.2.7)
npm version patch && git push origin main --tags

# Minor release (0.2.6 -> 0.3.0)
npm version minor && git push origin main --tags

# Major release (0.2.6 -> 1.0.0)
npm version major && git push origin main --tags
```

Then check the progress at: https://github.com/emqx/mcp-typescript-sdk/actions

## Configuration Requirements

For Trusted Publishing to work, the following must be configured:

### 1. package.json

Must include `repository.url` matching the GitHub repository:

```json
{
  "repository": {
    "type": "git",
    "url": "https://github.com/emqx/mcp-typescript-sdk"
  }
}
```

### 2. GitHub Actions Workflow

The workflow (`.github/workflows/release.yml`) must have:

- **Node.js 22+** or manually upgrade npm to >= 11.5.1
- **Permissions**: `id-token: write` for OIDC authentication
- **Registry URL**: Set to `https://registry.npmjs.org`

```yaml
permissions:
  contents: read
  id-token: write

steps:
  - uses: actions/setup-node@v4
    with:
      node-version: '22'
      registry-url: 'https://registry.npmjs.org'
  - run: npm install -g npm@latest
  - run: npm publish --provenance --access public
```

### 3. npm Trusted Publisher Configuration

Configure at https://www.npmjs.com/package/@emqx-ai/mcp-mqtt-sdk/access:

| Field | Value |
|-------|-------|
| Platform | GitHub Actions |
| Owner | `emqx` |
| Repository | `mcp-typescript-sdk` |
| Workflow filename | `release.yml` |
| Environment | (leave empty) |

## Troubleshooting

### Error: npm version too old

```
npm ERR! 403 ... Two-factor authentication or granular access token required
```

**Solution**: Ensure npm >= 11.5.1. The workflow should include `npm install -g npm@latest`.

### Error: repository.url mismatch

```
npm error 422 ... package.json: "repository.url" is "", expected to match ...
```

**Solution**: Add `repository.url` in package.json matching your GitHub repository URL.

### Error: 404 Not Found

```
npm ERR! 404 Not Found - PUT https://registry.npmjs.org/...
```

**Solution**: Verify the Trusted Publisher configuration on npm matches exactly:
- Organization/user name (case-sensitive)
- Repository name
- Workflow filename

## References

- [npm Trusted Publishing Documentation](https://docs.npmjs.com/trusted-publishers/)
- [GitHub Changelog - npm trusted publishing with OIDC](https://github.blog/changelog/2025-07-31-npm-trusted-publishing-with-oidc-is-generally-available/)
- [Generating provenance statements](https://docs.npmjs.com/generating-provenance-statements/)
