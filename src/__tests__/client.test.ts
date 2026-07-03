import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mocks = vi.hoisted(() => {
  const instances: Array<{ config: Record<string, unknown> }> = [];
  class FakeNCentralClient {
    config: Record<string, unknown>;
    constructor(config: Record<string, unknown>) {
      this.config = config;
      instances.push(this);
    }
  }
  return { FakeNCentralClient, instances };
});

vi.mock('@wyre-technology/node-ncentral', () => ({
  NCentralClient: mocks.FakeNCentralClient,
}));

import {
  applyGatewayCredentials,
  getClient,
  getCredentials,
  resetClient,
  serverLabel,
} from '../utils/client.js';

const ENV_KEYS = ['NCENTRAL_SERVER_URL', 'NCENTRAL_JWT'] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
  resetClient();
  mocks.instances.length = 0;
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe('getCredentials', () => {
  it('returns null when nothing is configured', () => {
    expect(getCredentials()).toBeNull();
  });

  it('returns null when only one credential is set', () => {
    process.env.NCENTRAL_SERVER_URL = 'https://ncentral.example.com';
    expect(getCredentials()).toBeNull();
  });

  it('returns both credentials when configured', () => {
    process.env.NCENTRAL_SERVER_URL = 'https://ncentral.example.com';
    process.env.NCENTRAL_JWT = 'jwt-1';
    expect(getCredentials()).toEqual({
      serverUrl: 'https://ncentral.example.com',
      jwt: 'jwt-1',
    });
  });
});

describe('serverLabel', () => {
  it('falls back to a generic label without a configured URL', () => {
    expect(serverLabel()).toBe('the configured N-central server');
  });

  it('uses the configured server URL', () => {
    process.env.NCENTRAL_SERVER_URL = 'https://ncentral.example.com';
    expect(serverLabel()).toBe('https://ncentral.example.com');
  });
});

describe('getClient singleton', () => {
  it('throws a clear error when credentials are missing', async () => {
    await expect(getClient()).rejects.toThrow(/NCENTRAL_SERVER_URL and NCENTRAL_JWT/);
  });

  it('constructs the client once and reuses it for the same credentials', async () => {
    process.env.NCENTRAL_SERVER_URL = 'https://ncentral.example.com';
    process.env.NCENTRAL_JWT = 'jwt-1';

    const first = await getClient();
    const second = await getClient();

    expect(first).toBe(second);
    expect(mocks.instances).toHaveLength(1);
    expect(mocks.instances[0].config).toEqual({
      serverUrl: 'https://ncentral.example.com',
      jwt: 'jwt-1',
    });
  });

  it('builds a new client when the JWT changes', async () => {
    process.env.NCENTRAL_SERVER_URL = 'https://ncentral.example.com';
    process.env.NCENTRAL_JWT = 'jwt-1';
    const first = await getClient();

    process.env.NCENTRAL_JWT = 'jwt-2';
    const second = await getClient();

    expect(second).not.toBe(first);
    expect(mocks.instances).toHaveLength(2);
    expect(mocks.instances[1].config.jwt).toBe('jwt-2');
  });

  it('builds a new client when the server URL changes', async () => {
    process.env.NCENTRAL_SERVER_URL = 'https://a.example.com';
    process.env.NCENTRAL_JWT = 'jwt-1';
    const first = await getClient();

    process.env.NCENTRAL_SERVER_URL = 'https://b.example.com';
    const second = await getClient();

    expect(second).not.toBe(first);
    expect(mocks.instances).toHaveLength(2);
  });

  it('resetClient forces a rebuild on the next call', async () => {
    process.env.NCENTRAL_SERVER_URL = 'https://ncentral.example.com';
    process.env.NCENTRAL_JWT = 'jwt-1';
    const first = await getClient();
    resetClient();
    const second = await getClient();

    expect(second).not.toBe(first);
    expect(mocks.instances).toHaveLength(2);
  });
});

describe('applyGatewayCredentials (gateway header handling)', () => {
  it('copies headers into process.env', () => {
    applyGatewayCredentials({
      'x-ncentral-server-url': 'https://gw.example.com',
      'x-ncentral-jwt': 'gw-jwt',
    });
    expect(process.env.NCENTRAL_SERVER_URL).toBe('https://gw.example.com');
    expect(process.env.NCENTRAL_JWT).toBe('gw-jwt');
  });

  it('does not clear existing credentials when headers are absent', () => {
    process.env.NCENTRAL_SERVER_URL = 'https://env.example.com';
    process.env.NCENTRAL_JWT = 'env-jwt';
    applyGatewayCredentials({});
    expect(process.env.NCENTRAL_SERVER_URL).toBe('https://env.example.com');
    expect(process.env.NCENTRAL_JWT).toBe('env-jwt');
  });

  it('resets the client singleton when the header credentials change', async () => {
    applyGatewayCredentials({
      'x-ncentral-server-url': 'https://gw.example.com',
      'x-ncentral-jwt': 'tenant-a',
    });
    const first = await getClient();

    // Same credentials again — client must be reused.
    applyGatewayCredentials({
      'x-ncentral-server-url': 'https://gw.example.com',
      'x-ncentral-jwt': 'tenant-a',
    });
    expect(await getClient()).toBe(first);
    expect(mocks.instances).toHaveLength(1);

    // Different tenant — client must be rebuilt.
    applyGatewayCredentials({
      'x-ncentral-server-url': 'https://gw.example.com',
      'x-ncentral-jwt': 'tenant-b',
    });
    const second = await getClient();
    expect(second).not.toBe(first);
    expect(mocks.instances).toHaveLength(2);
    expect(mocks.instances[1].config.jwt).toBe('tenant-b');
  });

  it('takes the first value of array headers', () => {
    applyGatewayCredentials({
      'x-ncentral-server-url': ['https://one.example.com', 'https://two.example.com'],
      'x-ncentral-jwt': ['jwt-one'],
    });
    expect(process.env.NCENTRAL_SERVER_URL).toBe('https://one.example.com');
    expect(process.env.NCENTRAL_JWT).toBe('jwt-one');
  });
});
