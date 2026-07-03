import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../server.js';
import {
  DOMAIN_NAMES,
  getBackTool,
  getNavigationTools,
  getState,
  resetStates,
} from '../domains/navigation.js';

const ENV_KEYS = ['NCENTRAL_SERVER_URL', 'NCENTRAL_JWT'] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  resetStates();
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

describe('navigation tool definitions', () => {
  it('exposes ncentral_navigate and ncentral_status as the navigation tools', () => {
    expect(getNavigationTools().map((t) => t.name)).toEqual([
      'ncentral_navigate',
      'ncentral_status',
    ]);
  });

  it('ncentral_navigate enumerates all eight domains and requires the domain arg', () => {
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
    expect(nav!.inputSchema.required).toEqual(['domain']);
  });

  it('getBackTool returns the ncentral_back tool', () => {
    expect(getBackTool().name).toBe('ncentral_back');
  });
});

describe('navigation state machine (via MCP client)', () => {
  it('initial tools/list exposes only the navigation tools', async () => {
    const client = await connectedClient();
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(['ncentral_navigate', 'ncentral_status']);
  });

  it('navigate exposes the domain tools plus ncentral_back', async () => {
    const client = await connectedClient();
    const result = await client.callTool({
      name: 'ncentral_navigate',
      arguments: { domain: 'devices' },
    });
    const text = (result.content as Array<{ text: string }>)[0].text;
    expect(text).toContain('Navigated to devices');

    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name);
    expect(names).toContain('ncentral_list_devices');
    expect(names).toContain('ncentral_get_device');
    expect(names).toContain('ncentral_back');
    expect(names).not.toContain('ncentral_navigate');
  });

  it('back returns to the navigation menu', async () => {
    const client = await connectedClient();
    await client.callTool({ name: 'ncentral_navigate', arguments: { domain: 'orgs' } });
    await client.callTool({ name: 'ncentral_back', arguments: {} });

    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(['ncentral_navigate', 'ncentral_status']);
    expect(getState('default').currentDomain).toBeNull();
  });

  it('rejects navigation to an unknown domain', async () => {
    const client = await connectedClient();
    const result = await client.callTool({
      name: 'ncentral_navigate',
      arguments: { domain: 'bogus' },
    });
    expect(result.isError).toBe(true);
  });

  it('rejects domain tool calls before navigation', async () => {
    const client = await connectedClient();
    const result = await client.callTool({
      name: 'ncentral_list_devices',
      arguments: {},
    });
    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ text: string }>)[0].text;
    expect(text).toContain('ncentral_navigate');
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
