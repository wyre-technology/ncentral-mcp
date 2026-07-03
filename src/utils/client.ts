/**
 * NCentralClient singleton with credential-change invalidation.
 *
 * Credentials come from the environment (NCENTRAL_SERVER_URL + NCENTRAL_JWT).
 * In gateway mode the HTTP layer copies the per-request headers
 * (x-ncentral-server-url / x-ncentral-jwt) into process.env before the MCP
 * request is handled, and the singleton is keyed on (serverUrl, jwt) so a
 * credential change transparently builds a fresh client.
 */
import type { NCentralClient } from '@wyre-technology/node-ncentral';
import { logger } from './logger.js';

export interface Credentials {
  serverUrl: string;
  jwt: string;
}

let _client: NCentralClient | null = null;
let _credentials: Credentials | null = null;

export function getCredentials(): Credentials | null {
  const serverUrl = process.env.NCENTRAL_SERVER_URL;
  const jwt = process.env.NCENTRAL_JWT;
  if (!serverUrl || !jwt) return null;
  return { serverUrl, jwt };
}

/** Human-readable server name for error messages. */
export function serverLabel(): string {
  return process.env.NCENTRAL_SERVER_URL || 'the configured N-central server';
}

export async function getClient(): Promise<NCentralClient> {
  const creds = getCredentials();
  if (!creds) {
    throw new Error(
      'No N-central credentials configured. Set NCENTRAL_SERVER_URL and NCENTRAL_JWT ' +
        'environment variables, or pass x-ncentral-server-url / x-ncentral-jwt headers in gateway mode.'
    );
  }

  // Invalidate the cached client if either credential changed (the gateway
  // injects per-request credentials, which may belong to a different tenant).
  if (
    _client &&
    _credentials &&
    (creds.serverUrl !== _credentials.serverUrl || creds.jwt !== _credentials.jwt)
  ) {
    logger.debug('N-central credentials changed — rebuilding client');
    _client = null;
    _credentials = null;
  }

  if (!_client) {
    const { NCentralClient } = await import('@wyre-technology/node-ncentral');
    _client = new NCentralClient({ serverUrl: creds.serverUrl, jwt: creds.jwt });
    _credentials = creds;
  }
  return _client;
}

export function resetClient(): void {
  _client = null;
  _credentials = null;
}

/**
 * Gateway mode: copy per-request credential headers into process.env and
 * invalidate the client singleton when they change. Requests without
 * credentials are NEVER rejected — tools/list must work without them;
 * tools/call fails with a clear error instead.
 */
export function applyGatewayCredentials(
  headers: Record<string, string | string[] | undefined>
): void {
  const serverUrl = headerValue(headers['x-ncentral-server-url']);
  const jwt = headerValue(headers['x-ncentral-jwt']);

  let changed = false;
  if (serverUrl && serverUrl !== process.env.NCENTRAL_SERVER_URL) {
    process.env.NCENTRAL_SERVER_URL = serverUrl;
    changed = true;
  }
  if (jwt && jwt !== process.env.NCENTRAL_JWT) {
    process.env.NCENTRAL_JWT = jwt;
    changed = true;
  }
  if (changed) {
    resetClient();
  }
}

function headerValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}
