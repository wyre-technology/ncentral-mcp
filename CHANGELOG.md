# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial N-central MCP server with decision-tree navigation (`ncentral_navigate`,
  `ncentral_back`, `ncentral_status`).
- Domains: system, orgs, devices, monitoring, tasks, custom-properties, maintenance,
  access-groups (37 tools total).
- Stdio and stateless Streamable HTTP transports; gateway credential injection via
  `x-ncentral-server-url` / `x-ncentral-jwt` headers.
- Elicitation support: device-list scope narrowing, confirmation prompts for direct
  task execution and maintenance window deletion.
- Destructive tool annotations per fleet policy (HIGH-IMPACT / IRREVERSIBLE tiers).
- Explicit "No X found" errors for empty results (anti-hallucination).
- Dockerfile (node:22-alpine, GHCR), semantic-release, CI release workflow.

[Unreleased]: https://github.com/wyre-technology/ncentral-mcp/commits/main
