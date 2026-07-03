import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { MaintenanceWindowRequest } from '@wyre-technology/node-ncentral';
import type { CallToolResult, DomainHandler } from '../utils/types.js';
import { getClient, serverLabel } from '../utils/client.js';
import { elicitConfirmation } from '../utils/elicitation.js';
import {
  errorResult,
  jsonResult,
  paginatedResult,
  paginationProperties,
  pickPagination,
  toNumber,
  toNumberArray,
} from '../utils/results.js';

function getTools(): Tool[] {
  return [
    {
      name: 'ncentral_list_maintenance_windows',
      description: 'List the maintenance windows configured for a device.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          deviceId: { type: 'number', description: 'Device id' },
          ...paginationProperties,
        },
        required: ['deviceId'],
      },
    },
    {
      name: 'ncentral_add_maintenance_windows',
      description:
        '⚠ HIGH-IMPACT. Adds maintenance windows to one or more devices. During a ' +
        'maintenance window, monitoring notifications and/or patching behavior on ' +
        'those devices changes for the scheduled period. ' +
        'Confirm with the user before invoking.',
      annotations: {
        title: 'Add device maintenance windows',
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
      inputSchema: {
        type: 'object' as const,
        properties: {
          deviceIds: {
            type: 'array',
            description: 'Device ids to add the maintenance windows to',
            items: { type: 'number' },
          },
          windows: {
            type: 'array',
            description:
              'Maintenance window definitions. Each requires name, type, cron ' +
              '(schedule expression), duration (minutes), enabled (boolean), and ' +
              'applicableAction (array of { type, actions }); optional fields include ' +
              'rebootMethod, rebootDelay, maxDowntime, userMessage settings.',
            items: { type: 'object' },
          },
        },
        required: ['deviceIds', 'windows'],
      },
    },
    {
      name: 'ncentral_delete_maintenance_windows',
      description:
        '⚠ DESTRUCTIVE — IRREVERSIBLE. Permanently deletes maintenance window ' +
        'schedules by schedule id. The schedules are removed from every associated ' +
        'device and cannot be recovered. Confirm with the user before invoking.',
      annotations: {
        title: 'Delete maintenance windows (irreversible)',
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
      inputSchema: {
        type: 'object' as const,
        properties: {
          scheduleIds: {
            type: 'array',
            description: 'Maintenance window schedule ids to delete',
            items: { type: 'number' },
          },
        },
        required: ['scheduleIds'],
      },
    },
  ];
}

async function handleCall(
  toolName: string,
  args: Record<string, unknown>
): Promise<CallToolResult> {
  const client = await getClient();

  switch (toolName) {
    case 'ncentral_list_maintenance_windows': {
      const deviceId = toNumber(args.deviceId);
      // Endpoint is device-scoped and unpaginated server-side; pagination args
      // are accepted for interface consistency but may be ignored by the API.
      pickPagination(args);
      const result = await client.devices.maintenanceWindows(deviceId);
      return paginatedResult(
        result,
        `No maintenance windows found for device ${deviceId} on ${serverLabel()}.`
      );
    }
    case 'ncentral_add_maintenance_windows': {
      const deviceIds = toNumberArray(args.deviceIds);
      const windows = (args.windows ?? []) as unknown as MaintenanceWindowRequest[];
      const result = await client.devices.addMaintenanceWindows(deviceIds, windows);
      return jsonResult(result ?? { added: true, deviceIds, windowCount: windows.length });
    }
    case 'ncentral_delete_maintenance_windows': {
      const scheduleIds = toNumberArray(args.scheduleIds);

      const confirmed = await elicitConfirmation(
        `About to PERMANENTLY DELETE ${scheduleIds.length} maintenance window ` +
          `schedule(s) (ids: ${scheduleIds.join(', ')}) on ${serverLabel()}. ` +
          'This cannot be undone. Proceed?'
      );
      if (confirmed === false) {
        return errorResult('Maintenance window deletion cancelled by user.');
      }
      // confirmed === null means the client doesn't support elicitation —
      // proceed with the original behavior (the tool description already
      // requires the caller to confirm with the user first).

      const result = await client.devices.deleteMaintenanceWindows(scheduleIds);
      return jsonResult(result ?? { deleted: true, scheduleIds });
    }
    default:
      return errorResult(`Unknown tool: ${toolName}`);
  }
}

export const maintenanceHandler: DomainHandler = { getTools, handleCall };
