import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { CallToolResult, DomainHandler } from '../utils/types.js';
import { getClient, serverLabel } from '../utils/client.js';
import { elicitConfirmation } from '../utils/elicitation.js';
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
      name: 'ncentral_list_device_tasks',
      description: 'List the scheduled tasks associated with a device.',
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
      name: 'ncentral_get_task',
      description: 'Get a scheduled task by id.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          taskId: { type: 'number', description: 'Scheduled task id' },
        },
        required: ['taskId'],
      },
    },
    {
      name: 'ncentral_get_task_status',
      description: 'Get the aggregated status of a scheduled task.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          taskId: { type: 'number', description: 'Scheduled task id' },
        },
        required: ['taskId'],
      },
    },
    {
      name: 'ncentral_get_task_status_details',
      description: 'Get the detailed per-device status entries for a scheduled task.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          taskId: { type: 'number', description: 'Scheduled task id' },
          ...paginationProperties,
        },
        required: ['taskId'],
      },
    },
    {
      name: 'ncentral_create_direct_task',
      description:
        '⚠ HIGH-IMPACT. Creates a direct-support remote execution task that runs ' +
        'IMMEDIATELY on a live endpoint — there is no queue, review step, or undo. ' +
        'The referenced script/item executes on the target device as soon as the task ' +
        'is created. Confirm with the user before invoking.',
      annotations: {
        title: 'Execute direct task on device (immediate)',
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
      inputSchema: {
        type: 'object' as const,
        properties: {
          name: { type: 'string', description: 'Name for the task' },
          deviceId: { type: 'number', description: 'Target device id' },
          itemId: {
            type: 'number',
            description: 'Repository item id of the script/task to execute',
          },
          customerId: { type: 'number', description: 'Customer id owning the device (optional)' },
          taskType: { type: 'string', description: 'Task type (optional)' },
          credential: {
            type: 'object',
            description:
              'Execution credential, e.g. { "type": "LocalSystem" } or ' +
              '{ "type": "CustomCredentials", "username": "...", "password": "..." } (optional)',
          },
          parameters: {
            type: 'array',
            description: 'Script parameters as [{ "name": "...", "value": "..." }] (optional)',
            items: { type: 'object' },
          },
        },
        required: ['name', 'deviceId', 'itemId'],
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
    case 'ncentral_list_device_tasks': {
      const deviceId = args.deviceId as number;
      const result = await client.devices.tasks(deviceId, pagination);
      return paginatedResult(
        result,
        `No scheduled tasks found for device ${deviceId} on ${serverLabel()}.`
      );
    }
    case 'ncentral_get_task': {
      const taskId = args.taskId as number;
      const task = await client.scheduledTasks.get(taskId);
      return entityResult(task, `No task found with id ${taskId} on ${serverLabel()}.`);
    }
    case 'ncentral_get_task_status': {
      const taskId = args.taskId as number;
      const status = await client.scheduledTasks.status(taskId);
      return entityResult(
        status,
        `No status found for task ${taskId} on ${serverLabel()}.`
      );
    }
    case 'ncentral_get_task_status_details': {
      const taskId = args.taskId as number;
      const details = await client.scheduledTasks.statusDetails(taskId, pagination);
      return paginatedResult(
        details,
        `No status details found for task ${taskId} on ${serverLabel()}.`
      );
    }
    case 'ncentral_create_direct_task': {
      const name = args.name as string;
      const deviceId = args.deviceId as number;

      const confirmed = await elicitConfirmation(
        `About to create direct task "${name}" which will execute IMMEDIATELY on device ` +
          `${deviceId} (${serverLabel()}). There is no queue, review step, or undo. Proceed?`
      );
      if (confirmed === false) {
        return errorResult('Direct task cancelled by user.');
      }
      // confirmed === null means the client doesn't support elicitation —
      // proceed with the original behavior (the tool description already
      // requires the caller to confirm with the user first).

      const result = await client.scheduledTasks.createDirect({ ...args });
      return jsonResult(result ?? { created: true, name, deviceId });
    }
    default:
      return errorResult(`Unknown tool: ${toolName}`);
  }
}

export const tasksHandler: DomainHandler = { getTools, handleCall };
