import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import {
  DOMAIN_NAMES,
  getBackTool,
  getNavigationTools,
  getState,
  handleStatus,
} from './domains/navigation.js';
import { getDomainHandler } from './domains/index.js';
import { setServerRef } from './utils/server-ref.js';
import { logger } from './utils/logger.js';
import type { DomainName } from './utils/types.js';

export function createServer(): Server {
  const server = new Server(
    { name: 'ncentral-mcp', version: '1.0.0' },
    { capabilities: { tools: { listChanged: true } } }
  );

  setServerRef(server);

  server.setRequestHandler(ListToolsRequestSchema, async (_request, extra) => {
    const sessionId = (extra as { sessionId?: string }).sessionId || 'default';
    const state = getState(sessionId);

    if (!state.currentDomain) {
      return { tools: getNavigationTools() };
    }

    const handler = await getDomainHandler(state.currentDomain);
    return { tools: [...handler.getTools(), getBackTool()] };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    const { name, arguments: args } = request.params;
    const sessionId = (extra as { sessionId?: string }).sessionId || 'default';
    const state = getState(sessionId);

    if (name === 'ncentral_navigate') {
      const domain = args?.domain as DomainName;
      if (!DOMAIN_NAMES.includes(domain)) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Unknown domain: ${domain}. Valid domains: ${DOMAIN_NAMES.join(', ')}`,
            },
          ],
          isError: true,
        };
      }
      state.currentDomain = domain;
      const handler = await getDomainHandler(domain);
      const tools = handler.getTools().map((t) => t.name);
      await server.sendToolListChanged();
      return {
        content: [
          {
            type: 'text' as const,
            text: `Navigated to ${domain}. Available tools: ${tools.join(', ')}. Use ncentral_back to return to the domain menu.`,
          },
        ],
      };
    }

    if (name === 'ncentral_back') {
      state.currentDomain = null;
      await server.sendToolListChanged();
      return {
        content: [{ type: 'text' as const, text: 'Returned to domain navigation.' }],
      };
    }

    if (name === 'ncentral_status') {
      return handleStatus(state.currentDomain);
    }

    if (!state.currentDomain) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Unknown tool: ${name}. Use ncentral_navigate first to select a domain.`,
          },
        ],
        isError: true,
      };
    }

    const handler = await getDomainHandler(state.currentDomain);
    try {
      return await handler.handleCall(name, args || {});
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Tool call failed', { tool: name, error: message });
      return {
        content: [{ type: 'text' as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  });

  return server;
}
