import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { CallToolResult, DomainHandler } from '../utils/types.js';
import { getClient, serverLabel } from '../utils/client.js';
import {
  entityResult,
  errorResult,
  paginatedResult,
  paginationProperties,
  pickPagination,
  toNumber,
  toOptionalNumber,
} from '../utils/results.js';

function getTools(): Tool[] {
  return [
    {
      name: 'ncentral_list_service_orgs',
      description: 'List service organizations (top-level org units) on the N-central server.',
      inputSchema: {
        type: 'object' as const,
        properties: { ...paginationProperties },
      },
    },
    {
      name: 'ncentral_list_customers',
      description:
        'List customers. Optionally scope to a single service organization with soId; ' +
        'omit soId to list all customers on the server.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          soId: {
            type: 'number',
            description: 'Service organization id to scope the listing (optional)',
          },
          ...paginationProperties,
        },
      },
    },
    {
      name: 'ncentral_get_customer',
      description: 'Get a single customer by id.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          customerId: { type: 'number', description: 'Customer id' },
        },
        required: ['customerId'],
      },
    },
    {
      name: 'ncentral_list_sites',
      description:
        'List sites. Optionally scope to a single customer with customerId; ' +
        'omit customerId to list all sites on the server.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          customerId: {
            type: 'number',
            description: 'Customer id to scope the listing (optional)',
          },
          ...paginationProperties,
        },
      },
    },
    {
      name: 'ncentral_get_site',
      description: 'Get a single site by id.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          siteId: { type: 'number', description: 'Site id' },
        },
        required: ['siteId'],
      },
    },
    {
      name: 'ncentral_list_org_units',
      description:
        'List all org units (service organizations, customers, and sites) on the server.',
      inputSchema: {
        type: 'object' as const,
        properties: { ...paginationProperties },
      },
    },
    {
      name: 'ncentral_get_org_unit',
      description: 'Get a single org unit by id.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          orgUnitId: { type: 'number', description: 'Org unit id' },
        },
        required: ['orgUnitId'],
      },
    },
    {
      name: 'ncentral_list_org_unit_children',
      description: 'List the child org units of an org unit.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          orgUnitId: { type: 'number', description: 'Parent org unit id' },
          ...paginationProperties,
        },
        required: ['orgUnitId'],
      },
    },
    {
      name: 'ncentral_get_registration_token',
      description:
        'Get the agent/probe registration token for a customer, site, or org unit. ' +
        'SENSITIVE: the registration token authorizes device registration against ' +
        'this org unit — treat it as a secret; do not store, log, or share it.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          kind: {
            type: 'string',
            enum: ['customer', 'site', 'org-unit'],
            description: 'The kind of entity the id refers to',
          },
          id: { type: 'number', description: 'Customer, site, or org unit id' },
        },
        required: ['kind', 'id'],
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
    case 'ncentral_list_service_orgs': {
      const result = await client.serviceOrgs.list(pagination);
      return paginatedResult(result, `No service organizations found on ${serverLabel()}.`);
    }
    case 'ncentral_list_customers': {
      const soId = toOptionalNumber(args.soId);
      const result =
        soId !== undefined
          ? await client.serviceOrgs.customers(soId, pagination)
          : await client.customers.list(pagination);
      const scope = soId !== undefined ? ` under service organization ${soId}` : '';
      return paginatedResult(result, `No customers found${scope} on ${serverLabel()}.`);
    }
    case 'ncentral_get_customer': {
      const customerId = toNumber(args.customerId);
      const customer = await client.customers.get(customerId);
      return entityResult(
        customer,
        `No customer found with id ${customerId} on ${serverLabel()}.`
      );
    }
    case 'ncentral_list_sites': {
      const customerId = toOptionalNumber(args.customerId);
      const result =
        customerId !== undefined
          ? await client.customers.sites(customerId, pagination)
          : await client.sites.list(pagination);
      const scope = customerId !== undefined ? ` under customer ${customerId}` : '';
      return paginatedResult(result, `No sites found${scope} on ${serverLabel()}.`);
    }
    case 'ncentral_get_site': {
      const siteId = toNumber(args.siteId);
      const site = await client.sites.get(siteId);
      return entityResult(site, `No site found with id ${siteId} on ${serverLabel()}.`);
    }
    case 'ncentral_list_org_units': {
      const result = await client.orgUnits.list(pagination);
      return paginatedResult(result, `No org units found on ${serverLabel()}.`);
    }
    case 'ncentral_get_org_unit': {
      const orgUnitId = toNumber(args.orgUnitId);
      const orgUnit = await client.orgUnits.get(orgUnitId);
      return entityResult(
        orgUnit,
        `No org unit found with id ${orgUnitId} on ${serverLabel()}.`
      );
    }
    case 'ncentral_list_org_unit_children': {
      const orgUnitId = toNumber(args.orgUnitId);
      const result = await client.orgUnits.children(orgUnitId, pagination);
      return paginatedResult(
        result,
        `No child org units found for org unit ${orgUnitId} on ${serverLabel()}.`
      );
    }
    case 'ncentral_get_registration_token': {
      const kind = args.kind as string;
      const id = toNumber(args.id);
      let token: unknown;
      switch (kind) {
        case 'customer':
          token = await client.customers.registrationToken(id);
          break;
        case 'site':
          token = await client.sites.registrationToken(id);
          break;
        case 'org-unit':
          token = await client.orgUnits.registrationToken(id);
          break;
        default:
          return errorResult(`Unknown registration token kind: ${kind}`);
      }
      return entityResult(
        token,
        `No registration token returned for ${kind} ${id} on ${serverLabel()}.`
      );
    }
    default:
      return errorResult(`Unknown tool: ${toolName}`);
  }
}

export const orgsHandler: DomainHandler = { getTools, handleCall };
