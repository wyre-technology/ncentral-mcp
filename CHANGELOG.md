# 1.0.0 (2026-07-03)


### Bug Fixes

* align domain handlers with published node-ncentral SDK signatures ([1d927b7](https://github.com/wyre-technology/ncentral-mcp/commit/1d927b78a8349d4834d2cb669f451963eb0e7e54))
* **ci:** grant packages:read to release job so npm ci can read @wyre-technology/node-ncentral ([2681def](https://github.com/wyre-technology/ncentral-mcp/commit/2681def01dbcd58fc21db153576400fa8b4150d5))
* **deps:** resolve @wyre-technology/node-ncentral@1.0.0 from GitHub Packages in lockfile ([e239c0d](https://github.com/wyre-technology/ncentral-mcp/commit/e239c0d9a4bd3534e0777984ee9505f173c3463b))
* install published node-ncentral@1.0.0 and align with real SDK behavior ([3741d1c](https://github.com/wyre-technology/ncentral-mcp/commit/3741d1cc21840734fe525105f27d74855f304cc2))


### Features

* domain handlers, decision-tree navigation, stdio + stateless HTTP transports ([75bcf93](https://github.com/wyre-technology/ncentral-mcp/commit/75bcf930acbfc2930fbf0b24a30fb40b95aecf15))

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
