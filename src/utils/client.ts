/**
 * NCentralClient factory with request-scoped credentials.
 *
 * Credentials come from the environment (NCENTRAL_SERVER_URL + NCENTRAL_JWT)
 * for stdio/single-tenant mode, or from an AsyncLocalStorage-scoped store in
 * gateway mode: the HTTP layer wraps each request in
 * runWithCredentials({serverUrl, jwt}, handler) so concurrent requests from
 * different tenants never observe each other's credentials. A fresh client
 * is built per call — no shared/mutable singleton.
 */
import { NCentralClient } from '@wyre-technology/node-ncentral';
import { AsyncLocalStorage } from 'node:async_hooks';
import { logger } from './logger.js';

export interface Credentials {
  serverUrl: string;
  jwt: string;
}

// Request-scoped credential store. In gateway mode the HTTP layer runs each
// request inside runWithCredentials({serverUrl, jwt}); getCredentials() reads
// it. Falls back to process.env for stdio/single-tenant mode.
const credStore = new AsyncLocalStorage<Credentials>();

export function runWithCredentials<T>(creds: Credentials, fn: () => T): T {
  return credStore.run(creds, fn);
}

export function getCredentials(): Credentials | null {
  const scoped = credStore.getStore();
  if (scoped?.serverUrl && scoped?.jwt) return scoped;
  const serverUrl = process.env.NCENTRAL_SERVER_URL;
  const jwt = process.env.NCENTRAL_JWT;
  if (!serverUrl || !jwt) return null;
  return { serverUrl, jwt };
}

/** Human-readable server name for error messages. */
export function serverLabel(): string {
  return getCredentials()?.serverUrl || 'the configured N-central server';
}

export async function getClient(): Promise<NCentralClient> {
  const creds = getCredentials();
  if (!creds) {
    throw new Error(
      'No N-central credentials configured. Set NCENTRAL_SERVER_URL and NCENTRAL_JWT ' +
        'environment variables, or pass x-ncentral-server-url / x-ncentral-jwt headers in gateway mode.'
    );
  }

  logger.debug('Building N-central client', { serverUrl: creds.serverUrl });
  return new NCentralClient({ serverUrl: creds.serverUrl, jwt: creds.jwt });
}
