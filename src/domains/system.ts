import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { CallToolResult, DomainHandler } from '../utils/types.js';
import { getClient, serverLabel } from '../utils/client.js';
import { entityResult, errorResult } from '../utils/results.js';

function getTools(): Tool[] {
  return [
    {
      name: 'ncentral_health',
      description:
        'Get the N-central API health status (server start time and current time). ' +
        'Useful as a lightweight liveness check.',
      inputSchema: { type: 'object' as const, properties: {} },
    },
    {
      name: 'ncentral_server_info',
      description: 'Get N-central server version and API-Service version information.',
      inputSchema: { type: 'object' as const, properties: {} },
    },
    {
      name: 'ncentral_validate_token',
      description:
        'Validate the configured N-central API access token. Reports whether the ' +
        'current credentials can authenticate against the server.',
      inputSchema: { type: 'object' as const, properties: {} },
    },
  ];
}

async function handleCall(
  toolName: string,
  _args: Record<string, unknown>
): Promise<CallToolResult> {
  const client = await getClient();

  switch (toolName) {
    case 'ncentral_health': {
      const health = await client.system.health();
      return entityResult(health, `No health data returned from ${serverLabel()}.`);
    }
    case 'ncentral_server_info': {
      const info = await client.system.serverInfo();
      return entityResult(info, `No server info returned from ${serverLabel()}.`);
    }
    case 'ncentral_validate_token': {
      const result = await client.system.validateToken();
      return entityResult(result, `Token validation returned no data from ${serverLabel()}.`);
    }
    default:
      return errorResult(`Unknown tool: ${toolName}`);
  }
}

export const systemHandler: DomainHandler = { getTools, handleCall };
