import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { CallToolResult, DomainName } from '../utils/types.js';
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

/**
 * Informational helper tools. Every domain tool is exposed flat alongside these
 * (see server.ts / getAllDomainTools), so navigation is optional — these tools
 * only provide guidance and a connectivity check, they never gate the tool list.
 */
export function getNavigationTools(): Tool[] {
  return [
    {
      name: 'ncentral_navigate',
      description:
        'Optional helper describing the N-central tool domains. All tools are ' +
        'exposed directly, so you can call any tool by name without navigating ' +
        'first. Domains: ' +
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
            description: 'Optional domain to describe',
          },
        },
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

/**
 * Handler for ncentral_navigate — purely informational. Since every tool is
 * exposed flat, this just reports the available domains (and echoes the given
 * domain, if any) so callers understand the tool surface. It never changes
 * which tools are listed or callable.
 */
export async function handleNavigate(domain?: DomainName): Promise<CallToolResult> {
  return jsonResult({
    domain: domain ?? null,
    domains: DOMAIN_NAMES,
    note:
      'All N-central tools are exposed directly. Call any tool by name — ' +
      'navigating to a domain first is not required.',
  });
}

/** Handler for ncentral_status — reports connectivity via health + server info. */
export async function handleStatus(): Promise<CallToolResult> {
  const creds = getCredentials();
  if (!creds) {
    return jsonResult({
      connected: false,
      reason:
        'No credentials configured. Set NCENTRAL_SERVER_URL and NCENTRAL_JWT ' +
        'environment variables, or pass x-ncentral-server-url / x-ncentral-jwt headers in gateway mode.',
      domains: DOMAIN_NAMES,
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
