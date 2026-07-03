#!/usr/bin/env node
/**
 * N-central MCP server — stdio entry point.
 * For the HTTP (gateway) transport, run dist/http.js with MCP_TRANSPORT=http.
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';
import { logger } from './utils/logger.js';

const server = createServer();
const transport = new StdioServerTransport();
await server.connect(transport);
logger.info('N-central MCP server started (stdio)');
