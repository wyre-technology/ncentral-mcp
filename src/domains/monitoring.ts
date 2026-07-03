import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { CallToolResult, DomainHandler } from '../utils/types.js';
import { getClient, serverLabel } from '../utils/client.js';
import {
  errorResult,
  paginatedResult,
  paginationProperties,
  pickPagination,
  toNumber,
} from '../utils/results.js';

function getTools(): Tool[] {
  return [
    {
      name: 'ncentral_list_active_issues',
      description:
        'List the active issues for an org unit. orgUnitId is required and must be a ' +
        'customer or site — service organizations are not supported by this endpoint.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          orgUnitId: {
            type: 'number',
            description: 'Customer or site org unit id (service orgs are not supported)',
          },
          ...paginationProperties,
        },
        required: ['orgUnitId'],
      },
    },
    {
      name: 'ncentral_list_job_statuses',
      description: 'List the job statuses for an org unit.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          orgUnitId: { type: 'number', description: 'Org unit id' },
          ...paginationProperties,
        },
        required: ['orgUnitId'],
      },
    },
  ];
}

async function handleCall(
  toolName: string,
  args: Record<string, unknown>
): Promise<CallToolResult> {
  const client = await getClient();
  const pagination = pickPagination(args);
  const orgUnitId = toNumber(args.orgUnitId);

  switch (toolName) {
    case 'ncentral_list_active_issues': {
      const result = await client.orgUnits.activeIssues(orgUnitId, pagination);
      return paginatedResult(
        result,
        `No active issues found for org unit ${orgUnitId} on ${serverLabel()}.`
      );
    }
    case 'ncentral_list_job_statuses': {
      const result = await client.orgUnits.jobStatuses(orgUnitId, pagination);
      return paginatedResult(
        result,
        `No job statuses found for org unit ${orgUnitId} on ${serverLabel()}.`
      );
    }
    default:
      return errorResult(`Unknown tool: ${toolName}`);
  }
}

export const monitoringHandler: DomainHandler = { getTools, handleCall };
