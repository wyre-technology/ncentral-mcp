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
  toNumber,
} from '../utils/results.js';

function getTools(): Tool[] {
  return [
    {
      name: 'ncentral_list_org_custom_properties',
      description: 'List the custom properties defined for an org unit.',
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
      name: 'ncentral_get_org_custom_property',
      description: 'Get a single custom property of an org unit.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          orgUnitId: { type: 'number', description: 'Org unit id' },
          propertyId: { type: 'number', description: 'Custom property id' },
        },
        required: ['orgUnitId', 'propertyId'],
      },
    },
    {
      name: 'ncentral_update_org_custom_property',
      description:
        '⚠ HIGH-IMPACT. Overwrites the value of an org unit custom property in ' +
        'N-central. Custom property values often drive automation, filters, and ' +
        'billing — the previous value is replaced. Confirm with the user before invoking.',
      annotations: {
        title: 'Update org unit custom property',
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
      inputSchema: {
        type: 'object' as const,
        properties: {
          orgUnitId: { type: 'number', description: 'Org unit id' },
          propertyId: { type: 'number', description: 'Custom property id' },
          value: { type: 'string', description: 'New property value' },
        },
        required: ['orgUnitId', 'propertyId', 'value'],
      },
    },
    {
      name: 'ncentral_list_device_custom_properties',
      description: 'List the custom properties defined for a device.',
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
      name: 'ncentral_get_device_custom_property',
      description: 'Get a single custom property of a device.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          deviceId: { type: 'number', description: 'Device id' },
          propertyId: { type: 'number', description: 'Custom property id' },
        },
        required: ['deviceId', 'propertyId'],
      },
    },
    {
      name: 'ncentral_update_device_custom_property',
      description:
        '⚠ HIGH-IMPACT. Overwrites the value of a device custom property in N-central. ' +
        'Custom property values often drive automation, filters, and monitoring rules — ' +
        'the previous value is replaced. Confirm with the user before invoking.',
      annotations: {
        title: 'Update device custom property',
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
      inputSchema: {
        type: 'object' as const,
        properties: {
          deviceId: { type: 'number', description: 'Device id' },
          propertyId: { type: 'number', description: 'Custom property id' },
          value: { type: 'string', description: 'New property value' },
        },
        required: ['deviceId', 'propertyId', 'value'],
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
  const propertyId = toNumber(args.propertyId);

  switch (toolName) {
    case 'ncentral_list_org_custom_properties': {
      const orgUnitId = toNumber(args.orgUnitId);
      const result = await client.orgUnits.customProperties(orgUnitId, pagination);
      return paginatedResult(
        result,
        `No custom properties found for org unit ${orgUnitId} on ${serverLabel()}.`
      );
    }
    case 'ncentral_get_org_custom_property': {
      const orgUnitId = toNumber(args.orgUnitId);
      const property = await client.orgUnits.getCustomProperty(orgUnitId, propertyId);
      return entityResult(
        property,
        `No custom property ${propertyId} found for org unit ${orgUnitId} on ${serverLabel()}.`
      );
    }
    case 'ncentral_update_org_custom_property': {
      const orgUnitId = toNumber(args.orgUnitId);
      const value = args.value as string;
      const result = await client.orgUnits.updateCustomProperty(orgUnitId, propertyId, value);
      return jsonResult(result ?? { updated: true, orgUnitId, propertyId, value });
    }
    case 'ncentral_list_device_custom_properties': {
      const deviceId = toNumber(args.deviceId);
      const result = await client.devices.customProperties(deviceId, pagination);
      return paginatedResult(
        result,
        `No custom properties found for device ${deviceId} on ${serverLabel()}.`
      );
    }
    case 'ncentral_get_device_custom_property': {
      const deviceId = toNumber(args.deviceId);
      const property = await client.devices.getCustomProperty(deviceId, propertyId);
      return entityResult(
        property,
        `No custom property ${propertyId} found for device ${deviceId} on ${serverLabel()}.`
      );
    }
    case 'ncentral_update_device_custom_property': {
      const deviceId = toNumber(args.deviceId);
      const value = args.value as string;
      const result = await client.devices.updateCustomProperty(deviceId, propertyId, value);
      return jsonResult(result ?? { updated: true, deviceId, propertyId, value });
    }
    default:
      return errorResult(`Unknown tool: ${toolName}`);
  }
}

export const customPropertiesHandler: DomainHandler = { getTools, handleCall };
