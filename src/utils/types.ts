import type { Tool } from '@modelcontextprotocol/sdk/types.js';

export type DomainName =
  | 'system'
  | 'orgs'
  | 'devices'
  | 'monitoring'
  | 'tasks'
  | 'custom-properties'
  | 'maintenance'
  | 'access-groups';

export type CallToolResult = {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
};

export interface DomainHandler {
  getTools(): Tool[];
  handleCall(toolName: string, args: Record<string, unknown>): Promise<CallToolResult>;
}

export type NavigationState = {
  currentDomain: DomainName | null;
};

/** Standard N-central pagination query params (see developer.n-able.com). */
export interface PaginationParams {
  pageNumber?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: string;
}

/** The paginated envelope returned by N-central list endpoints. */
export interface PaginatedEnvelope<T = unknown> {
  data?: T[];
  pageNumber?: number;
  pageSize?: number;
  itemCount?: number;
  totalItems?: number;
  totalPages?: number;
}
