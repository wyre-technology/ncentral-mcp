#!/usr/bin/env node
/**
 * N-central MCP server — stdio entry point.
 * For the HTTP (gateway) transport, run dist/http.js with MCP_TRANSPORT=http.
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';
import { bindServerRef } from './utils/server-ref.js';
import { logger } from './utils/logger.js';

const server = createServer();
// stdio is single-session (one process = one caller), so there is no
// concurrent tenant to isolate from — bind once for the process lifetime
// rather than per-request. See utils/server-ref.ts.
bindServerRef(server);
const transport = new StdioServerTransport();
await server.connect(transport);
logger.info('N-central MCP server started (stdio)');
