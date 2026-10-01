import { AsyncLocalStorage } from 'node:async_hooks';
import type { PoolClient, QueryResult } from 'pg';

export interface DatabaseRequestContext {
  client?: PoolClient | { query: (text: string, params?: any[]) => Promise<QueryResult<any>> };
  tenantId?: string;
  authUserId?: string;
  isSuperAdmin?: boolean;
}

export const dbContextStorage = new AsyncLocalStorage<DatabaseRequestContext>();

export function getRequestContextDb(): { query: (text: string, params?: any[]) => Promise<QueryResult<any>> } | undefined {
  const store = dbContextStorage.getStore();
  return store?.client;
}
