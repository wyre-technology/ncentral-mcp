/**
 * N-central MCP server — Streamable HTTP entry point.
 *
 * SECURITY-CRITICAL invariant: the transport MUST stay stateless
 * (sessionIdGenerator: undefined + enableJsonResponse: true) with a fresh
 * Server + Transport per request. The gateway sends initialize, tools/list,
 * and tools/call as separate HTTP requests; a shared or stateful server
 * rejects the second initialize ("Server already initialized") and clients
 * see zero tools. NEVER switch this to a stateful/SSE session transport.
 */
import { createServer as createHttpServer } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createServer } from './server.js';
import { applyGatewayCredentials, getCredentials } from './utils/client.js';
import { logger } from './utils/logger.js';

function startHttpServer(): void {
  const port = parseInt(process.env.MCP_HTTP_PORT || '8080', 10);
  const host = process.env.MCP_HTTP_HOST || '0.0.0.0';
  const isGatewayMode = process.env.AUTH_MODE === 'gateway';

  const httpServer = createHttpServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (url.pathname === '/health') {
      // Liveness: must NOT gate on credentials (the ACA probe carries none)
      // or the container crash-loops.
      const creds = getCredentials();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: 'ok',
          transport: 'http',
          authMode: isGatewayMode ? 'gateway' : 'env',
          credentials: { configured: !!creds },
          timestamp: new Date().toISOString(),
        })
      );
      return;
    }

    if (url.pathname !== '/mcp') {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found', endpoints: ['/mcp', '/health'] }));
      return;
    }

    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          jsonrpc: '2.0',
          error: { code: -32000, message: 'Method not allowed' },
          id: null,
        })
      );
      return;
    }

    // Gateway mode: copy per-request credential headers into process.env and
    // invalidate the client singleton when they change. Requests WITHOUT
    // credentials are never rejected — tools/list must work without them;
    // tools/call fails with a clear error message instead.
    if (isGatewayMode) {
      applyGatewayCredentials(req.headers);
    }

    try {
      // Stateless: fresh Server + Transport per request.
      const server = createServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });

      res.on('close', () => {
        transport.close();
        server.close();
      });

      await server.connect(transport);
      await transport.handleRequest(req, res);
    } catch (error) {
      logger.error('MCP transport error', {
        error: error instanceof Error ? error.message : String(error),
      });
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            jsonrpc: '2.0',
            error: { code: -32603, message: 'Internal error' },
            id: null,
          })
        );
      }
    }
  });

  httpServer.listen(port, host, () => {
    logger.info(`N-central MCP server listening on http://${host}:${port}/mcp`);
    logger.info(`Health check available at http://${host}:${port}/health`);
    logger.info(`Authentication mode: ${isGatewayMode ? 'gateway (header-based)' : 'env'}`);
  });
}

if (process.env.MCP_TRANSPORT === 'http') {
  startHttpServer();
} else {
  import('./index.js');
}
