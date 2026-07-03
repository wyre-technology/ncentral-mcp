import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { CallToolResult, DomainHandler, PaginatedEnvelope } from '../utils/types.js';
import { getClient, serverLabel } from '../utils/client.js';
import { elicitSelection } from '../utils/elicitation.js';
import {
  entityResult,
  errorResult,
  jsonResult,
  paginatedResult,
  paginationProperties,
  pickPagination,
} from '../utils/results.js';

type NCentralClient = Awaited<ReturnType<typeof getClient>>;

function getTools(): Tool[] {
  return [
    {
      name: 'ncentral_list_devices',
      description:
        'List devices on the N-central server. Optionally scope with a saved device ' +
        'filter (filterId). If no filter is given, the user is offered the chance to ' +
        'narrow the scope to a device filter or org unit before listing everything.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          filterId: {
            type: 'number',
            description: 'Saved device filter id to scope the listing (optional)',
          },
          ...paginationProperties,
        },
      },
    },
    {
      name: 'ncentral_get_device',
      description: 'Get a single device by id.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          deviceId: { type: 'number', description: 'Device id' },
        },
        required: ['deviceId'],
      },
    },
    {
      name: 'ncentral_get_device_assets',
      description:
        'Get asset information for a device (hardware, OS, installed software inventory).',
      inputSchema: {
        type: 'object' as const,
        properties: {
          deviceId: { type: 'number', description: 'Device id' },
        },
        required: ['deviceId'],
      },
    },
    {
      name: 'ncentral_get_device_lifecycle',
      description:
        'Get asset lifecycle information for a device (warranty expiry, purchase date, ' +
        'expected replacement date, cost).',
      inputSchema: {
        type: 'object' as const,
        properties: {
          deviceId: { type: 'number', description: 'Device id' },
        },
        required: ['deviceId'],
      },
    },
    {
      name: 'ncentral_update_device_lifecycle',
      description:
        '⚠ HIGH-IMPACT. Updates the asset lifecycle information (warranty expiry, ' +
        'purchase date, expected replacement date, cost, description) recorded for a ' +
        'device in N-central. Existing lifecycle values are overwritten. ' +
        'Confirm with the user before invoking.',
      annotations: {
        title: 'Update device lifecycle info',
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
      inputSchema: {
        type: 'object' as const,
        properties: {
          deviceId: { type: 'number', description: 'Device id' },
          data: {
            type: 'object',
            description:
              'Lifecycle fields to set, e.g. warrantyExpiryDate, purchaseDate, ' +
              'expectedReplacementDate, cost, description (ISO 8601 dates)',
          },
        },
        required: ['deviceId', 'data'],
      },
    },
    {
      name: 'ncentral_get_device_service_status',
      description: 'Get the service monitor status for a device (per-service health states).',
      inputSchema: {
        type: 'object' as const,
        properties: {
          deviceId: { type: 'number', description: 'Device id' },
        },
        required: ['deviceId'],
      },
    },
    {
      name: 'ncentral_list_devices_by_org_unit',
      description: 'List the devices registered under a specific org unit (customer or site).',
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
      name: 'ncentral_list_device_filters',
      description:
        'List the saved device filters available on the server. Filter ids can be ' +
        'passed to ncentral_list_devices to scope device listings.',
      inputSchema: {
        type: 'object' as const,
        properties: { ...paginationProperties },
      },
    },
  ];
}

type DeviceScope =
  | { kind: 'all' }
  | { kind: 'filter'; filterId: number }
  | { kind: 'orgUnit'; orgUnitId: number };

/**
 * Zero-filter device list: offer to narrow the scope to a saved device filter
 * or an org unit. Purely additive — any elicitation failure falls back to the
 * original behavior (list everything).
 */
async function resolveDeviceScope(client: NCentralClient): Promise<DeviceScope> {
  try {
    const choice = await elicitSelection(
      'No device filter specified — listing every device can return thousands of rows. Narrow the scope?',
      'scope',
      [
        { value: 'filter', label: 'Pick a saved device filter' },
        { value: 'orgUnit', label: 'Pick an org unit (customer/site)' },
        { value: 'all', label: 'List all devices' },
      ]
    );

    if (choice === 'filter') {
      const filters = (await client.deviceFilters.list({
        pageSize: 25,
      })) as unknown as PaginatedEnvelope<Record<string, unknown>>;
      const items = Array.isArray(filters?.data) ? filters.data : [];
      const options = items.slice(0, 25).map((f) => {
        const id = f.filterId ?? f.id;
        const name = f.filterName ?? f.name ?? id;
        return { value: String(id), label: String(name) };
      });
      if (options.length > 0) {
        const picked = await elicitSelection('Select a device filter:', 'filterId', options);
        if (picked) return { kind: 'filter', filterId: Number(picked) };
      }
    } else if (choice === 'orgUnit') {
      const orgUnits = (await client.orgUnits.list({
        pageSize: 25,
      })) as unknown as PaginatedEnvelope<Record<string, unknown>>;
      const items = Array.isArray(orgUnits?.data) ? orgUnits.data : [];
      const options = items.slice(0, 25).map((o) => {
        const id = o.orgUnitId ?? o.id;
        const name = o.orgUnitName ?? o.name ?? id;
        const type = o.orgUnitType ?? o.type ?? 'org unit';
        return { value: String(id), label: `${name} (${type} ${id})` };
      });
      if (options.length > 0) {
        const picked = await elicitSelection('Select an org unit:', 'orgUnitId', options);
        if (picked) return { kind: 'orgUnit', orgUnitId: Number(picked) };
      }
    }
  } catch {
    // Elicitation is additive — fall through to the original behavior.
  }
  return { kind: 'all' };
}

async function handleCall(
  toolName: string,
  args: Record<string, unknown>
): Promise<CallToolResult> {
  const client = await getClient();
  const pagination = pickPagination(args);

  switch (toolName) {
    case 'ncentral_list_devices': {
      let filterId = args.filterId as number | undefined;

      if (filterId === undefined) {
        const scope = await resolveDeviceScope(client);
        if (scope.kind === 'filter') {
          filterId = scope.filterId;
        } else if (scope.kind === 'orgUnit') {
          const result = await client.orgUnits.devices(scope.orgUnitId, pagination);
          return paginatedResult(
            result,
            `No devices found for org unit ${scope.orgUnitId} on ${serverLabel()}.`
          );
        }
      }

      const result = await client.devices.list({ ...pagination, filterId });
      const scopeText = filterId !== undefined ? ` matching device filter ${filterId}` : '';
      return paginatedResult(result, `No devices found${scopeText} on ${serverLabel()}.`);
    }
    case 'ncentral_get_device': {
      const deviceId = args.deviceId as number;
      const device = await client.devices.get(deviceId);
      return entityResult(device, `No device found with id ${deviceId} on ${serverLabel()}.`);
    }
    case 'ncentral_get_device_assets': {
      const deviceId = args.deviceId as number;
      const assets = await client.devices.assets(deviceId);
      return entityResult(
        assets,
        `No asset information found for device ${deviceId} on ${serverLabel()}.`
      );
    }
    case 'ncentral_get_device_lifecycle': {
      const deviceId = args.deviceId as number;
      const lifecycle = await client.devices.lifecycleInfo(deviceId);
      return entityResult(
        lifecycle,
        `No lifecycle information found for device ${deviceId} on ${serverLabel()}.`
      );
    }
    case 'ncentral_update_device_lifecycle': {
      const deviceId = args.deviceId as number;
      const data = (args.data ?? {}) as Record<string, unknown>;
      const result = await client.devices.updateLifecycleInfo(deviceId, data);
      return jsonResult(result ?? { updated: true, deviceId, lifecycle: data });
    }
    case 'ncentral_get_device_service_status': {
      const deviceId = args.deviceId as number;
      const status = await client.devices.serviceMonitorStatus(deviceId);
      return paginatedResult(
        status,
        `No service monitor status found for device ${deviceId} on ${serverLabel()}.`
      );
    }
    case 'ncentral_list_devices_by_org_unit': {
      const orgUnitId = args.orgUnitId as number;
      const result = await client.orgUnits.devices(orgUnitId, pagination);
      return paginatedResult(
        result,
        `No devices found for org unit ${orgUnitId} on ${serverLabel()}.`
      );
    }
    case 'ncentral_list_device_filters': {
      const result = await client.deviceFilters.list(pagination);
      return paginatedResult(result, `No device filters found on ${serverLabel()}.`);
    }
    default:
      return errorResult(`Unknown tool: ${toolName}`);
  }
}

export const devicesHandler: DomainHandler = { getTools, handleCall };
