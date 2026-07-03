import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
  const resources = {
    system: { health: vi.fn(), serverInfo: vi.fn(), links: vi.fn(), validateToken: vi.fn() },
    serviceOrgs: { list: vi.fn(), get: vi.fn(), create: vi.fn(), customers: vi.fn() },
    customers: {
      list: vi.fn(),
      get: vi.fn(),
      create: vi.fn(),
      sites: vi.fn(),
      registrationToken: vi.fn(),
    },
    sites: { list: vi.fn(), get: vi.fn(), create: vi.fn(), registrationToken: vi.fn() },
    orgUnits: {
      list: vi.fn(),
      get: vi.fn(),
      children: vi.fn(),
      devices: vi.fn(),
      activeIssues: vi.fn(),
      jobStatuses: vi.fn(),
      registrationToken: vi.fn(),
      customProperties: vi.fn(),
      getCustomProperty: vi.fn(),
      updateCustomProperty: vi.fn(),
      updateDefaultCustomProperty: vi.fn(),
      getDeviceDefaultCustomProperty: vi.fn(),
    },
    devices: {
      list: vi.fn(),
      get: vi.fn(),
      assets: vi.fn(),
      lifecycleInfo: vi.fn(),
      updateLifecycleInfo: vi.fn(),
      serviceMonitorStatus: vi.fn(),
      tasks: vi.fn(),
      maintenanceWindows: vi.fn(),
      addMaintenanceWindows: vi.fn(),
      deleteMaintenanceWindows: vi.fn(),
      customProperties: vi.fn(),
      getCustomProperty: vi.fn(),
      updateCustomProperty: vi.fn(),
    },
    deviceFilters: { list: vi.fn() },
    scheduledTasks: {
      createDirect: vi.fn(),
      get: vi.fn(),
      status: vi.fn(),
      statusDetails: vi.fn(),
    },
    accessGroups: {
      list: vi.fn(),
      get: vi.fn(),
      createDeviceGroup: vi.fn(),
      createOrgUnitGroup: vi.fn(),
    },
  };

  class NCentralClient {
    constructor(config: Record<string, unknown>) {
      Object.assign(this, resources, { config });
    }
  }

  return { resources, NCentralClient };
});

vi.mock('@wyre-technology/node-ncentral', () => ({
  NCentralClient: mocks.NCentralClient,
}));

import { getDomainHandler } from '../domains/index.js';
import { resetClient } from '../utils/client.js';
import type { DomainName } from '../utils/types.js';

const DOMAINS: DomainName[] = [
  'system',
  'orgs',
  'devices',
  'monitoring',
  'tasks',
  'custom-properties',
  'maintenance',
  'access-groups',
];

const page = (data: unknown[]) => ({
  data,
  pageNumber: 1,
  pageSize: 50,
  itemCount: data.length,
  totalItems: data.length,
  totalPages: 1,
});

beforeEach(() => {
  process.env.NCENTRAL_SERVER_URL = 'https://ncentral.example.com';
  process.env.NCENTRAL_JWT = 'test-jwt';
  resetClient();
  vi.clearAllMocks();
});

describe('domain registry', () => {
  it('resolves a handler for every domain', async () => {
    for (const domain of DOMAINS) {
      const handler = await getDomainHandler(domain);
      expect(typeof handler.getTools).toBe('function');
      expect(typeof handler.handleCall).toBe('function');
    }
  });

  it('throws on an unknown domain', async () => {
    await expect(getDomainHandler('bogus' as DomainName)).rejects.toThrow(/Unknown domain/);
  });

  it('every handler exposes ncentral_-prefixed tools with object input schemas', async () => {
    for (const domain of DOMAINS) {
      const tools = (await getDomainHandler(domain)).getTools();
      expect(tools.length).toBeGreaterThan(0);
      for (const tool of tools) {
        expect(tool.name).toMatch(/^ncentral_/);
        expect(tool.inputSchema.type).toBe('object');
      }
    }
  });

  it('returns an isError result for an unrecognised tool name', async () => {
    for (const domain of DOMAINS) {
      const result = await (
        await getDomainHandler(domain)
      ).handleCall('ncentral_not_a_real_tool', {});
      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain('Unknown tool');
    }
  });
});

describe('system domain', () => {
  it('happy path: ncentral_health returns the health payload', async () => {
    mocks.resources.system.health.mockResolvedValue({ startTime: '2026-01-01T00:00:00Z' });
    const handler = await getDomainHandler('system');
    const result = await handler.handleCall('ncentral_health', {});
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('startTime');
  });

  it('empty result: ncentral_server_info with no data is an explicit error', async () => {
    mocks.resources.system.serverInfo.mockResolvedValue(undefined);
    const handler = await getDomainHandler('system');
    const result = await handler.handleCall('ncentral_server_info', {});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('No server info returned');
    expect(result.content[0].text).toContain('https://ncentral.example.com');
  });
});

describe('orgs domain', () => {
  it('happy path: ncentral_list_service_orgs returns data plus pagination metadata', async () => {
    mocks.resources.serviceOrgs.list.mockResolvedValue(
      page([{ orgUnitId: 1, orgUnitName: 'SO' }])
    );
    const handler = await getDomainHandler('orgs');
    const result = await handler.handleCall('ncentral_list_service_orgs', { pageSize: 10 });
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.data).toHaveLength(1);
    expect(parsed.pagination.totalItems).toBe(1);
    expect(mocks.resources.serviceOrgs.list).toHaveBeenCalledWith({ pageSize: 10 });
  });

  it('scopes ncentral_list_customers to a service org when soId is given', async () => {
    mocks.resources.serviceOrgs.customers.mockResolvedValue(page([{ customerId: 7 }]));
    const handler = await getDomainHandler('orgs');
    const result = await handler.handleCall('ncentral_list_customers', { soId: 100 });
    expect(result.isError).toBeUndefined();
    expect(mocks.resources.serviceOrgs.customers).toHaveBeenCalledWith(100, {});
    expect(mocks.resources.customers.list).not.toHaveBeenCalled();
  });

  it('empty result: ncentral_list_customers with zero rows is an explicit error', async () => {
    mocks.resources.customers.list.mockResolvedValue(page([]));
    const handler = await getDomainHandler('orgs');
    const result = await handler.handleCall('ncentral_list_customers', {});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('No customers found');
    expect(result.content[0].text).toContain('https://ncentral.example.com');
  });

  it('dispatches ncentral_get_registration_token by kind', async () => {
    mocks.resources.sites.registrationToken.mockResolvedValue({ token: 'secret' });
    const handler = await getDomainHandler('orgs');
    const result = await handler.handleCall('ncentral_get_registration_token', {
      kind: 'site',
      id: 42,
    });
    expect(result.isError).toBeUndefined();
    expect(mocks.resources.sites.registrationToken).toHaveBeenCalledWith(42);
    expect(mocks.resources.customers.registrationToken).not.toHaveBeenCalled();
  });
});

describe('devices domain', () => {
  it('happy path: ncentral_get_device returns the device', async () => {
    mocks.resources.devices.get.mockResolvedValue({ deviceId: 5, longName: 'DC01' });
    const handler = await getDomainHandler('devices');
    const result = await handler.handleCall('ncentral_get_device', { deviceId: 5 });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('DC01');
  });

  it('passes filterId and pagination through to the SDK', async () => {
    mocks.resources.devices.list.mockResolvedValue(page([{ deviceId: 1 }]));
    const handler = await getDomainHandler('devices');
    await handler.handleCall('ncentral_list_devices', { filterId: 3, pageNumber: 2 });
    expect(mocks.resources.devices.list).toHaveBeenCalledWith({ pageNumber: 2, filterId: 3 });
  });

  it('empty result: ncentral_list_devices with zero rows is an explicit error', async () => {
    mocks.resources.devices.list.mockResolvedValue(page([]));
    const handler = await getDomainHandler('devices');
    const result = await handler.handleCall('ncentral_list_devices', { filterId: 3 });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('No devices found');
    expect(result.content[0].text).toContain('device filter 3');
  });
});

describe('monitoring domain', () => {
  it('happy path: ncentral_list_active_issues returns issues for the org unit', async () => {
    mocks.resources.orgUnits.activeIssues.mockResolvedValue(
      page([{ issueId: 9, severity: 'failed' }])
    );
    const handler = await getDomainHandler('monitoring');
    const result = await handler.handleCall('ncentral_list_active_issues', { orgUnitId: 50 });
    expect(result.isError).toBeUndefined();
    expect(mocks.resources.orgUnits.activeIssues).toHaveBeenCalledWith(50, {});
    expect(JSON.parse(result.content[0].text).data).toHaveLength(1);
  });

  it('empty result: ncentral_list_job_statuses with zero rows is an explicit error', async () => {
    mocks.resources.orgUnits.jobStatuses.mockResolvedValue(page([]));
    const handler = await getDomainHandler('monitoring');
    const result = await handler.handleCall('ncentral_list_job_statuses', { orgUnitId: 50 });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('No job statuses found for org unit 50');
  });
});

describe('tasks domain', () => {
  it('happy path: ncentral_get_task returns the task', async () => {
    mocks.resources.scheduledTasks.get.mockResolvedValue({ taskId: 11, name: 'Reboot' });
    const handler = await getDomainHandler('tasks');
    const result = await handler.handleCall('ncentral_get_task', { taskId: 11 });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('Reboot');
  });

  it('empty result: ncentral_list_device_tasks with zero rows is an explicit error', async () => {
    mocks.resources.devices.tasks.mockResolvedValue(page([]));
    const handler = await getDomainHandler('tasks');
    const result = await handler.handleCall('ncentral_list_device_tasks', { deviceId: 5 });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('No scheduled tasks found for device 5');
  });

  it('ncentral_create_direct_task executes when elicitation is unavailable', async () => {
    // No server ref is set in this test file, so elicitConfirmation returns
    // null — the handler must proceed with the original behavior.
    mocks.resources.scheduledTasks.createDirect.mockResolvedValue({ taskId: 99 });
    const handler = await getDomainHandler('tasks');
    const result = await handler.handleCall('ncentral_create_direct_task', {
      name: 'Run script',
      deviceId: 5,
      itemId: 12,
    });
    expect(result.isError).toBeUndefined();
    expect(mocks.resources.scheduledTasks.createDirect).toHaveBeenCalledWith({
      name: 'Run script',
      deviceId: 5,
      itemId: 12,
    });
  });
});

describe('custom-properties domain', () => {
  it('happy path: ncentral_list_org_custom_properties returns properties', async () => {
    mocks.resources.orgUnits.customProperties.mockResolvedValue(
      page([{ propertyId: 1, label: 'Region' }])
    );
    const handler = await getDomainHandler('custom-properties');
    const result = await handler.handleCall('ncentral_list_org_custom_properties', {
      orgUnitId: 50,
    });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('Region');
  });

  it('empty result: ncentral_list_device_custom_properties with zero rows errors', async () => {
    mocks.resources.devices.customProperties.mockResolvedValue(page([]));
    const handler = await getDomainHandler('custom-properties');
    const result = await handler.handleCall('ncentral_list_device_custom_properties', {
      deviceId: 5,
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('No custom properties found for device 5');
  });

  it('ncentral_update_org_custom_property forwards the new value', async () => {
    mocks.resources.orgUnits.updateCustomProperty.mockResolvedValue(undefined);
    const handler = await getDomainHandler('custom-properties');
    const result = await handler.handleCall('ncentral_update_org_custom_property', {
      orgUnitId: 50,
      propertyId: 2,
      value: 'EMEA',
    });
    expect(result.isError).toBeUndefined();
    expect(mocks.resources.orgUnits.updateCustomProperty).toHaveBeenCalledWith(50, 2, 'EMEA');
    expect(JSON.parse(result.content[0].text)).toMatchObject({ updated: true, value: 'EMEA' });
  });
});

describe('maintenance domain', () => {
  it('happy path: ncentral_list_maintenance_windows handles a raw array response', async () => {
    mocks.resources.devices.maintenanceWindows.mockResolvedValue([
      { scheduleId: 3, name: 'Patch window' },
    ]);
    const handler = await getDomainHandler('maintenance');
    const result = await handler.handleCall('ncentral_list_maintenance_windows', {
      deviceId: 5,
    });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('Patch window');
  });

  it('empty result: ncentral_list_maintenance_windows with zero rows errors', async () => {
    mocks.resources.devices.maintenanceWindows.mockResolvedValue([]);
    const handler = await getDomainHandler('maintenance');
    const result = await handler.handleCall('ncentral_list_maintenance_windows', {
      deviceId: 5,
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('No maintenance windows found for device 5');
  });

  it('ncentral_delete_maintenance_windows proceeds when elicitation is unavailable', async () => {
    mocks.resources.devices.deleteMaintenanceWindows.mockResolvedValue(undefined);
    const handler = await getDomainHandler('maintenance');
    const result = await handler.handleCall('ncentral_delete_maintenance_windows', {
      scheduleIds: [3, 4],
    });
    expect(result.isError).toBeUndefined();
    expect(mocks.resources.devices.deleteMaintenanceWindows).toHaveBeenCalledWith([3, 4]);
    expect(JSON.parse(result.content[0].text)).toMatchObject({
      deleted: true,
      scheduleIds: [3, 4],
    });
  });
});

describe('access-groups domain', () => {
  it('happy path: ncentral_list_access_groups returns groups', async () => {
    mocks.resources.accessGroups.list.mockResolvedValue(
      page([{ groupId: 1, groupName: 'Helpdesk' }])
    );
    const handler = await getDomainHandler('access-groups');
    const result = await handler.handleCall('ncentral_list_access_groups', { orgUnitId: 50 });
    expect(result.isError).toBeUndefined();
    expect(mocks.resources.accessGroups.list).toHaveBeenCalledWith(50, {});
    expect(result.content[0].text).toContain('Helpdesk');
  });

  it('empty result: ncentral_list_access_groups with zero rows errors', async () => {
    mocks.resources.accessGroups.list.mockResolvedValue(page([]));
    const handler = await getDomainHandler('access-groups');
    const result = await handler.handleCall('ncentral_list_access_groups', { orgUnitId: 50 });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('No access groups found for org unit 50');
  });
});

describe('credential errors surface clearly', () => {
  it('tool calls without credentials fail with a configuration message', async () => {
    delete process.env.NCENTRAL_SERVER_URL;
    delete process.env.NCENTRAL_JWT;
    resetClient();
    const handler = await getDomainHandler('system');
    await expect(handler.handleCall('ncentral_health', {})).rejects.toThrow(
      /No N-central credentials configured/
    );
  });
});
