import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { CallToolResult, DomainName, NavigationState } from '../utils/types.js';
import { getClient, getCredentials } from '../utils/client.js';
import { jsonResult } from '../utils/results.js';

export const DOMAIN_NAMES: DomainName[] = [
  'system',
  'orgs',
  'devices',
  'monitoring',
  'tasks',
  'custom-properties',
  'maintenance',
  'access-groups',
];

const sessionStates = new Map<string, NavigationState>();

export function getState(sessionId: string = 'default'): NavigationState {
  if (!sessionStates.has(sessionId)) {
    sessionStates.set(sessionId, { currentDomain: null });
  }
  return sessionStates.get(sessionId)!;
}

/** Test helper: clear all navigation state. */
export function resetStates(): void {
  sessionStates.clear();
}

export function getNavigationTools(): Tool[] {
  return [
    {
      name: 'ncentral_navigate',
      description:
        'Navigate to an N-central domain to access its tools. Domains: ' +
        'system (health, server info, token validation), ' +
        'orgs (service organizations, customers, sites, org units, registration tokens), ' +
        'devices (device inventory, assets, lifecycle, service status, saved filters), ' +
        'monitoring (active issues, job statuses), ' +
        'tasks (scheduled tasks, task status, direct task execution), ' +
        'custom-properties (org unit and device custom properties), ' +
        'maintenance (device maintenance windows), ' +
        'access-groups (device and org unit access groups).',
      inputSchema: {
        type: 'object' as const,
        properties: {
          domain: {
            type: 'string',
            enum: DOMAIN_NAMES,
            description: 'The domain to navigate to',
          },
        },
        required: ['domain'],
      },
    },
    {
      name: 'ncentral_status',
      description:
        'Check N-central connectivity and configuration. Calls the health and ' +
        'server-info endpoints, so it doubles as a connection test.',
      inputSchema: { type: 'object' as const, properties: {} },
    },
  ];
}

export function getBackTool(): Tool {
  return {
    name: 'ncentral_back',
    description: 'Return to the domain navigation menu.',
    inputSchema: { type: 'object' as const, properties: {} },
  };
}

/** Handler for ncentral_status — reports connectivity via health + server info. */
export async function handleStatus(currentDomain: DomainName | null): Promise<CallToolResult> {
  const creds = getCredentials();
  if (!creds) {
    return jsonResult({
      connected: false,
      reason:
        'No credentials configured. Set NCENTRAL_SERVER_URL and NCENTRAL_JWT ' +
        'environment variables, or pass x-ncentral-server-url / x-ncentral-jwt headers in gateway mode.',
      domains: DOMAIN_NAMES,
      currentDomain,
    });
  }

  try {
    const client = await getClient();
    const [health, serverInfo] = await Promise.all([
      client.system.health(),
      client.system.serverInfo(),
    ]);
    return jsonResult({
      connected: true,
      serverUrl: creds.serverUrl,
      health,
      serverInfo,
      domains: DOMAIN_NAMES,
      currentDomain,
    });
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              connected: false,
              serverUrl: creds.serverUrl,
              error: error instanceof Error ? error.message : String(error),
              domains: DOMAIN_NAMES,
              currentDomain,
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }
}
