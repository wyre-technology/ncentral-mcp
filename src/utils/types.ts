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

/** Sorting direction accepted by the N-central API (case insensitive). */
export type SortOrder =
  | 'asc'
  | 'ascending'
  | 'natural'
  | 'desc'
  | 'descending'
  | 'reverse'
  | 'ASC'
  | 'ASCENDING'
  | 'NATURAL'
  | 'DESC'
  | 'DESCENDING'
  | 'REVERSE';

/** Standard N-central pagination query params (see developer.n-able.com). */
export interface PaginationParams {
  pageNumber?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: SortOrder;
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
