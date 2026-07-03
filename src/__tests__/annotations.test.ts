import { describe, it, expect } from 'vitest';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { getDomainHandler } from '../domains/index.js';
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

const EXPECTED_DESTRUCTIVE = [
  'ncentral_update_device_lifecycle',
  'ncentral_create_direct_task',
  'ncentral_update_org_custom_property',
  'ncentral_update_device_custom_property',
  'ncentral_add_maintenance_windows',
  'ncentral_delete_maintenance_windows',
  'ncentral_create_device_access_group',
  'ncentral_create_org_unit_access_group',
].sort();

async function allTools(): Promise<Tool[]> {
  const tools: Tool[] = [];
  for (const domain of DOMAINS) {
    tools.push(...(await getDomainHandler(domain)).getTools());
  }
  return tools;
}

describe('destructive tool annotations', () => {
  it('exactly the expected tools are marked destructive', async () => {
    const tools = await allTools();
    const destructive = tools
      .filter((t) => t.annotations?.destructiveHint === true)
      .map((t) => t.name)
      .sort();
    expect(destructive).toEqual(EXPECTED_DESTRUCTIVE);
  });

  it('every destructive tool carries the warning prefix and confirmation suffix', async () => {
    const tools = await allTools();
    for (const tool of tools.filter((t) => t.annotations?.destructiveHint === true)) {
      expect(tool.description, tool.name).toMatch(/^⚠ (DESTRUCTIVE — IRREVERSIBLE|HIGH-IMPACT)\./);
      expect(tool.description, tool.name).toMatch(/Confirm with the user before invoking\.$/);
      expect(tool.annotations?.readOnlyHint, tool.name).toBe(false);
    }
  });

  it('ncentral_delete_maintenance_windows is tier A: irreversible and non-idempotent', async () => {
    const tools = await allTools();
    const del = tools.find((t) => t.name === 'ncentral_delete_maintenance_windows');
    expect(del).toBeDefined();
    expect(del!.description).toContain('⚠ DESTRUCTIVE — IRREVERSIBLE');
    expect(del!.annotations?.destructiveHint).toBe(true);
    expect(del!.annotations?.idempotentHint).toBe(false);
  });

  it('ncentral_create_direct_task warns about immediate execution', async () => {
    const tools = await allTools();
    const direct = tools.find((t) => t.name === 'ncentral_create_direct_task');
    expect(direct).toBeDefined();
    expect(direct!.description).toContain('IMMEDIATELY');
    expect(direct!.annotations?.destructiveHint).toBe(true);
    expect(direct!.annotations?.idempotentHint).toBe(false);
  });

  it('read-only tools carry neither the warning prefix nor a destructive hint', async () => {
    const tools = await allTools();
    for (const tool of tools.filter((t) => !EXPECTED_DESTRUCTIVE.includes(t.name))) {
      expect(tool.description, tool.name).not.toMatch(/^⚠/);
      expect(tool.annotations?.destructiveHint, tool.name).not.toBe(true);
    }
  });
});
