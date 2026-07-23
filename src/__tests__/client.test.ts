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

import { getClient, getCredentials, runWithCredentials, serverLabel } from '../utils/client.js';

const ENV_KEYS = ['NCENTRAL_SERVER_URL', 'NCENTRAL_JWT'] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
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

  it('returns both credentials when configured via env', () => {
    process.env.NCENTRAL_SERVER_URL = 'https://ncentral.example.com';
    process.env.NCENTRAL_JWT = 'jwt-1';
    expect(getCredentials()).toEqual({
      serverUrl: 'https://ncentral.example.com',
      jwt: 'jwt-1',
    });
  });
});

describe('request-scoped credentials (AsyncLocalStorage)', () => {
  it('prefers ALS-scoped creds over process.env', () => {
    process.env.NCENTRAL_SERVER_URL = 'https://env.example.com';
    process.env.NCENTRAL_JWT = 'env-jwt';

    runWithCredentials({ serverUrl: 'https://scoped.example.com', jwt: 'scoped-jwt' }, () => {
      expect(getCredentials()).toEqual({
        serverUrl: 'https://scoped.example.com',
        jwt: 'scoped-jwt',
      });
    });

    // scope must not leak out
    expect(getCredentials()).toEqual({
      serverUrl: 'https://env.example.com',
      jwt: 'env-jwt',
    });
  });

  it('returns null for partial scoped creds (missing jwt)', () => {
    process.env.NCENTRAL_SERVER_URL = 'https://env.example.com';
    process.env.NCENTRAL_JWT = 'env-jwt';
    const partial = { serverUrl: 'https://scoped.example.com' } as {
      serverUrl: string;
      jwt: string;
    };
    runWithCredentials(partial, () => {
      // The guard requires BOTH fields; partial should fall through to env
      expect(getCredentials()?.serverUrl).toBe('https://env.example.com');
    });
  });

  it('does not contaminate a concurrent request with another tenant\'s credentials', async () => {
    const results: Array<{ serverUrl: string; jwt: string } | null> = [];

    await Promise.all([
      runWithCredentials(
        { serverUrl: 'https://tenant-a.example.com', jwt: 'tenant-a-jwt' },
        async () => {
          await new Promise(r => setTimeout(r, 10));
          results.push(getCredentials());
        }
      ),
      runWithCredentials(
        { serverUrl: 'https://tenant-b.example.com', jwt: 'tenant-b-jwt' },
        async () => {
          await new Promise(r => setTimeout(r, 5));
          results.push(getCredentials());
        }
      ),
    ]);

    // Both reads must resolve to their own tenant's creds with no cross-contamination
    expect(results).toHaveLength(2);
    const a = results.find(r => r?.jwt === 'tenant-a-jwt');
    const b = results.find(r => r?.jwt === 'tenant-b-jwt');
    expect(a).toEqual({ serverUrl: 'https://tenant-a.example.com', jwt: 'tenant-a-jwt' });
    expect(b).toEqual({ serverUrl: 'https://tenant-b.example.com', jwt: 'tenant-b-jwt' });
  });
});

describe('serverLabel', () => {
  it('falls back to a generic label without a configured URL', () => {
    expect(serverLabel()).toBe('the configured N-central server');
  });

  it('uses the configured server URL', () => {
    process.env.NCENTRAL_SERVER_URL = 'https://ncentral.example.com';
    process.env.NCENTRAL_JWT = 'jwt-1';
    expect(serverLabel()).toBe('https://ncentral.example.com');
  });

  it('uses the ALS-scoped server URL over env', () => {
    process.env.NCENTRAL_SERVER_URL = 'https://env.example.com';
    process.env.NCENTRAL_JWT = 'env-jwt';
    runWithCredentials({ serverUrl: 'https://scoped.example.com', jwt: 'scoped-jwt' }, () => {
      expect(serverLabel()).toBe('https://scoped.example.com');
    });
  });
});

describe('getClient', () => {
  it('throws a clear error when credentials are missing', async () => {
    await expect(getClient()).rejects.toThrow(/NCENTRAL_SERVER_URL and NCENTRAL_JWT/);
  });

  it('builds a client from env credentials', async () => {
    process.env.NCENTRAL_SERVER_URL = 'https://ncentral.example.com';
    process.env.NCENTRAL_JWT = 'jwt-1';

    const client = await getClient();

    expect(mocks.instances).toHaveLength(1);
    expect(mocks.instances[0].config).toEqual({
      serverUrl: 'https://ncentral.example.com',
      jwt: 'jwt-1',
    });
    expect(client).toBe(mocks.instances[0]);
  });

  it('builds a fresh client per call — no shared singleton across calls', async () => {
    process.env.NCENTRAL_SERVER_URL = 'https://ncentral.example.com';
    process.env.NCENTRAL_JWT = 'jwt-1';

    const first = await getClient();
    const second = await getClient();

    expect(second).not.toBe(first);
    expect(mocks.instances).toHaveLength(2);
  });

  it('builds each concurrent request its own client from its own scoped credentials', async () => {
    const [clientA, clientB] = await Promise.all([
      runWithCredentials(
        { serverUrl: 'https://tenant-a.example.com', jwt: 'tenant-a-jwt' },
        () => getClient()
      ),
      runWithCredentials(
        { serverUrl: 'https://tenant-b.example.com', jwt: 'tenant-b-jwt' },
        () => getClient()
      ),
    ]);

    expect(clientA).not.toBe(clientB);
    const configs = mocks.instances.map(i => i.config);
    expect(configs).toContainEqual({ serverUrl: 'https://tenant-a.example.com', jwt: 'tenant-a-jwt' });
    expect(configs).toContainEqual({ serverUrl: 'https://tenant-b.example.com', jwt: 'tenant-b-jwt' });
  });
});
