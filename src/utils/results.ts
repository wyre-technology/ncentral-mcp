/**
 * Result helpers shared by all domain handlers.
 *
 * Empty results deliberately return isError: true with an explicit
 * "No X found" message — never a bare empty array. An empty success response
 * invites the LLM to hallucinate data that does not exist in N-central.
 */
import type { CallToolResult, PaginatedEnvelope, PaginationParams, SortOrder } from './types.js';

export function jsonResult(value: unknown): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] };
}

export function errorResult(message: string): CallToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

/**
 * Single-entity ("get") results: a nullish or empty-object response becomes an
 * explicit not-found error instead of a hallucination-inviting empty success.
 */
export function entityResult(value: unknown, emptyMessage: string): CallToolResult {
  if (value == null) return errorResult(emptyMessage);
  if (
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value as Record<string, unknown>).length === 0
  ) {
    return errorResult(emptyMessage);
  }
  return jsonResult(value);
}

/**
 * Paginated list results: an empty page becomes an explicit error; otherwise
 * the response includes the pagination metadata so the LLM can page.
 * Defensively handles both raw arrays and the N-central paginated envelope.
 */
export function paginatedResult(response: unknown, emptyMessage: string): CallToolResult {
  const envelope = (response ?? {}) as PaginatedEnvelope;
  const items = Array.isArray(response)
    ? (response as unknown[])
    : Array.isArray(envelope.data)
      ? envelope.data
      : [];

  if (items.length === 0) return errorResult(emptyMessage);

  if (Array.isArray(response)) {
    return jsonResult({ data: items, itemCount: items.length });
  }

  return jsonResult({
    data: items,
    pagination: {
      pageNumber: envelope.pageNumber,
      pageSize: envelope.pageSize,
      itemCount: envelope.itemCount,
      totalItems: envelope.totalItems,
      totalPages: envelope.totalPages,
    },
  });
}

/** JSON-schema properties for the standard N-central pagination params. */
export const paginationProperties: Record<string, object> = {
  pageNumber: { type: 'number', description: '1-based page number (default 1)' },
  pageSize: {
    type: 'number',
    description: 'Items per page, 1-1000 (default 50; -1 requests the server maximum)',
  },
  sortBy: { type: 'string', description: 'Field name to sort by' },
  sortOrder: {
    type: 'string',
    enum: ['asc', 'ascending', 'natural', 'desc', 'descending', 'reverse'],
    description: 'Sort direction',
  },
};

/**
 * Coerce a tool argument to a number. N-central response models carry most
 * ids as strings (soId, customerId, siteId, orgUnitId, filterId), so LLMs
 * frequently echo them back as strings — but SDK method id params are numbers.
 */
export function toNumber(value: unknown): number {
  return typeof value === 'number' ? value : Number(value);
}

/** Optional-argument variant of toNumber. */
export function toOptionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return toNumber(value);
}

/** Coerce an array tool argument to number[]. */
export function toNumberArray(value: unknown): number[] {
  return Array.isArray(value) ? value.map((v) => toNumber(v)) : [];
}

/** Extract the standard pagination params from tool arguments. */
export function pickPagination(args: Record<string, unknown>): PaginationParams {
  const params: PaginationParams = {};
  if (typeof args.pageNumber === 'number') params.pageNumber = args.pageNumber;
  if (typeof args.pageSize === 'number') params.pageSize = args.pageSize;
  if (typeof args.sortBy === 'string') params.sortBy = args.sortBy;
  if (typeof args.sortOrder === 'string') params.sortOrder = args.sortOrder as SortOrder;
  return params;
}
