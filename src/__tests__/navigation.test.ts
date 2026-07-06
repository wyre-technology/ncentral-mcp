import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../server.js';
import { DOMAIN_NAMES, getNavigationTools } from '../domains/navigation.js';

const ENV_KEYS = ['NCENTRAL_SERVER_URL', 'NCENTRAL_JWT'] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

async function connectedClient() {
  const server = createServer();
  const client = new Client({ name: 'test-client', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return client;
}

// Tools that must appear in the flat list — one representative per domain plus
// the informational helpers.
const REPRESENTATIVE_TOOLS = [
  'ncentral_navigate',
  'ncentral_status',
  'ncentral_health', // system
  'ncentral_list_service_orgs', // orgs
  'ncentral_list_devices', // devices
  'ncentral_list_active_issues', // monitoring
  'ncentral_get_task', // tasks
  'ncentral_list_org_custom_properties', // custom-properties
  'ncentral_delete_maintenance_windows', // maintenance
  'ncentral_list_access_groups', // access-groups
];

describe('navigation helper definitions', () => {
  it('exposes ncentral_navigate and ncentral_status as the informational helpers', () => {
    expect(getNavigationTools().map((t) => t.name)).toEqual([
      'ncentral_navigate',
      'ncentral_status',
    ]);
  });

  it('ncentral_navigate enumerates all eight domains and no longer requires a domain', () => {
    const nav = getNavigationTools().find((t) => t.name === 'ncentral_navigate');
    expect(nav).toBeDefined();
    const props = nav!.inputSchema.properties as Record<string, { enum?: string[] }>;
    expect(props.domain?.enum).toEqual([
      'system',
      'orgs',
      'devices',
      'monitoring',
      'tasks',
      'custom-properties',
      'maintenance',
      'access-groups',
    ]);
    // Flat exposure: navigation is optional, so domain is no longer required.
    expect(nav!.inputSchema.required).toBeUndefined();
  });
});

describe('flat tool exposure (via MCP client)', () => {
  it('tools/list returns the full flat set regardless of state', async () => {
    const client = await connectedClient();
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name);

    // navigate + status + every domain tool are all present up front.
    for (const expected of REPRESENTATIVE_TOOLS) {
      expect(names, `expected ${expected} in flat tools/list`).toContain(expected);
    }
    // The full surface is exposed, not just the two navigation helpers.
    expect(tools.length).toBeGreaterThan(30);
    // ncentral_back was dropped — flat exposure makes it meaningless.
    expect(names).not.toContain('ncentral_back');
    // No duplicate tool names.
    expect(new Set(names).size).toBe(names.length);
  });

  it('a second tools/list is identical (listing does not depend on prior calls)', async () => {
    const client = await connectedClient();
    const first = (await client.listTools()).tools.map((t) => t.name).sort();
    await client.callTool({ name: 'ncentral_navigate', arguments: { domain: 'devices' } });
    const second = (await client.listTools()).tools.map((t) => t.name).sort();
    expect(second).toEqual(first);
  });

  it('a domain tool is callable without navigating first (routes straight to the handler)', async () => {
    const client = await connectedClient();
    // No credentials are configured, so the devices handler surfaces a
    // credentials error — proving the call was ROUTED to the handler rather
    // than blocked by a "navigate first" gate.
    const result = await client.callTool({ name: 'ncentral_list_devices', arguments: {} });
    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ text: string }>)[0].text;
    expect(text).toContain('No N-central credentials configured');
    expect(text).not.toContain('ncentral_navigate');
  });

  it('destructive tools keep their annotations in the flat list', async () => {
    const client = await connectedClient();
    const { tools } = await client.listTools();
    const del = tools.find((t) => t.name === 'ncentral_delete_maintenance_windows');
    expect(del).toBeDefined();
    expect(del!.annotations?.destructiveHint).toBe(true);
    expect(del!.annotations?.idempotentHint).toBe(false);
  });

  it('an unknown tool name returns an isError result', async () => {
    const client = await connectedClient();
    const result = await client.callTool({ name: 'ncentral_not_a_real_tool', arguments: {} });
    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ text: string }>)[0].text;
    expect(text).toContain('Unknown tool');
  });

  it('ncentral_navigate is an informational no-op that never gates the tool list', async () => {
    const client = await connectedClient();
    const result = await client.callTool({
      name: 'ncentral_navigate',
      arguments: { domain: 'devices' },
    });
    expect(result.isError).toBeUndefined();
    const status = JSON.parse((result.content as Array<{ text: string }>)[0].text);
    expect(status.domains).toEqual(DOMAIN_NAMES);
    expect(status.note).toContain('exposed directly');
  });

  it('ncentral_status reports not-connected when no credentials are configured', async () => {
    const client = await connectedClient();
    const result = await client.callTool({ name: 'ncentral_status', arguments: {} });
    const text = (result.content as Array<{ text: string }>)[0].text;
    const status = JSON.parse(text);
    expect(status.connected).toBe(false);
    expect(status.domains).toEqual(DOMAIN_NAMES);
  });
});
