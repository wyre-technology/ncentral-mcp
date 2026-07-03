import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { CallToolResult, DomainHandler } from '../utils/types.js';
import { getClient, serverLabel } from '../utils/client.js';
import {
  entityResult,
  errorResult,
  jsonResult,
  paginatedResult,
  paginationProperties,
  pickPagination,
} from '../utils/results.js';

function getTools(): Tool[] {
  return [
    {
      name: 'ncentral_list_access_groups',
      description: 'List the access groups defined for an org unit.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          orgUnitId: { type: 'number', description: 'Org unit id' },
          ...paginationProperties,
        },
        required: ['orgUnitId'],
      },
    },
    {
      name: 'ncentral_get_access_group',
      description: 'Get a single access group by id.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          accessGroupId: { type: 'number', description: 'Access group id' },
        },
        required: ['accessGroupId'],
      },
    },
    {
      name: 'ncentral_create_device_access_group',
      description:
        '⚠ HIGH-IMPACT. Creates a device access group, which controls which users ' +
        'can see and manage the listed devices. Access group changes affect user ' +
        'permissions across N-central. Confirm with the user before invoking.',
      annotations: {
        title: 'Create device access group',
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
      inputSchema: {
        type: 'object' as const,
        properties: {
          orgUnitId: { type: 'number', description: 'Org unit to create the group under' },
          groupName: { type: 'string', description: 'Name for the access group' },
          groupDescription: { type: 'string', description: 'Description for the access group' },
          deviceIds: {
            type: 'array',
            description: 'Device ids (as strings) to include in the group (optional)',
            items: { type: 'string' },
          },
          userIds: {
            type: 'array',
            description: 'User ids (as strings) to grant access to the group (optional)',
            items: { type: 'string' },
          },
        },
        required: ['orgUnitId', 'groupName', 'groupDescription'],
      },
    },
    {
      name: 'ncentral_create_org_unit_access_group',
      description:
        '⚠ HIGH-IMPACT. Creates an org unit access group, which controls which users ' +
        'can see and manage the listed org units (customers/sites) and everything ' +
        'inside them. Access group changes affect user permissions across N-central. ' +
        'Confirm with the user before invoking.',
      annotations: {
        title: 'Create org unit access group',
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
      inputSchema: {
        type: 'object' as const,
        properties: {
          orgUnitId: { type: 'number', description: 'Org unit to create the group under' },
          groupName: { type: 'string', description: 'Name for the access group' },
          groupDescription: { type: 'string', description: 'Description for the access group' },
          orgUnitIds: {
            type: 'array',
            description: 'Org unit ids (as strings) to include in the group (optional)',
            items: { type: 'string' },
          },
          userIds: {
            type: 'array',
            description: 'User ids (as strings) to grant access to the group (optional)',
            items: { type: 'string' },
          },
          autoIncludeNewOrgUnits: {
            type: 'string',
            description: 'Whether new org units are auto-included, "true" or "false" (optional)',
          },
        },
        required: ['orgUnitId', 'groupName', 'groupDescription'],
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

  switch (toolName) {
    case 'ncentral_list_access_groups': {
      const orgUnitId = args.orgUnitId as number;
      const result = await client.accessGroups.list(orgUnitId, pagination);
      return paginatedResult(
        result,
        `No access groups found for org unit ${orgUnitId} on ${serverLabel()}.`
      );
    }
    case 'ncentral_get_access_group': {
      const accessGroupId = args.accessGroupId as number;
      const group = await client.accessGroups.get(accessGroupId);
      return entityResult(
        group,
        `No access group found with id ${accessGroupId} on ${serverLabel()}.`
      );
    }
    case 'ncentral_create_device_access_group': {
      const orgUnitId = args.orgUnitId as number;
      const data = {
        groupName: args.groupName as string,
        groupDescription: args.groupDescription as string,
        deviceIds: args.deviceIds as string[] | undefined,
        userIds: args.userIds as string[] | undefined,
      };
      const result = await client.accessGroups.createDeviceGroup(orgUnitId, data);
      return jsonResult(result ?? { created: true, orgUnitId, groupName: data.groupName });
    }
    case 'ncentral_create_org_unit_access_group': {
      const orgUnitId = args.orgUnitId as number;
      const data = {
        groupName: args.groupName as string,
        groupDescription: args.groupDescription as string,
        orgUnitIds: args.orgUnitIds as string[] | undefined,
        userIds: args.userIds as string[] | undefined,
        autoIncludeNewOrgUnits: args.autoIncludeNewOrgUnits as string | undefined,
      };
      const result = await client.accessGroups.createOrgUnitGroup(orgUnitId, data);
      return jsonResult(result ?? { created: true, orgUnitId, groupName: data.groupName });
    }
    default:
      return errorResult(`Unknown tool: ${toolName}`);
  }
}

export const accessGroupsHandler: DomainHandler = { getTools, handleCall };
