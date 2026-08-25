# Contributing to ncentral-mcp

Thanks for your interest in contributing to the N-central MCP server!

## Getting Started

### Prerequisites

- Node.js 20 or higher
- npm 10 or higher
- Docker (for container testing)
- A GitHub Packages token with `read:packages` (to install `@wyre-technology/node-ncentral`);
  export it as `NODE_AUTH_TOKEN` so the committed `.npmrc` can authenticate

### Development Setup

1. Fork and clone the repository:

   ```bash
   git clone https://github.com/your-username/ncentral-mcp.git
   cd ncentral-mcp
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Run the test suite (the SDK is fully mocked — no live N-central server needed):

   ```bash
   npm test
   ```

## Development Workflow

1. Create a feature branch:

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes.

3. Verify everything passes:

   ```bash
   npm run typecheck
   npm run lint
   npm test
   npm run build
   ```

4. Open a pull request against `main`.

## Coding Standards

- TypeScript strict mode; eslint 9 flat config (`npm run lint`).
- One file per API domain under `src/domains/`; each exports a `DomainHandler`.
- All logging goes to **stderr** via `src/utils/logger.ts` — stdout is reserved for the
  MCP stdio protocol.
- Tools that mutate external state must carry the `⚠ HIGH-IMPACT.` or
  `⚠ DESTRUCTIVE — IRREVERSIBLE.` description prefix, end with
  `Confirm with the user before invoking.`, and set MCP `annotations`
  (`destructiveHint`, `idempotentHint`, etc.).
- Empty search/list results must return `isError: true` with an explicit
  "No X found" message — never a bare empty array.
- Elicitation is purely additive: wrap it in try/catch and fall back to the original
  behavior when it is unavailable.

## Commit Messages

This repo uses [Conventional Commits](https://www.conventionalcommits.org/) —
`feat:`, `fix:`, `docs:`, `test:`, `chore:`, etc. Release versions and the changelog
are generated from commit messages by semantic-release.

## Reporting Issues

Open an issue at <https://github.com/WYRE-AI/ncentral-mcp/issues> with
reproduction steps, expected vs. actual behavior, and your N-central version. Never
include your JWT or registration tokens in issue reports.

## License

By contributing, you agree that your contributions will be licensed under the
[Apache-2.0 License](LICENSE).
