import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'node:os';
import pg from 'pg';
import { rootCertificates } from 'node:tls';
import { resolveSslCa, getDatabaseSslConfig, parseDatabaseConfig, getDatabaseTlsDiagnostics } from '../src/db/connection.js';
import { maskConnectionString, runPreflight } from '../src/scripts/db-preflight.js';
import { sanitizeSensitiveString } from '../src/app.js';

describe('Phase 13: Database Preflight, TLS & Sanitization Unit Tests', () => {
  describe('1. Secret Masking & Redaction', () => {
    it('masks passwords in database URLs', () => {
      const input = 'postgres://fastify_runtime:superSecretPass123!@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?sslmode=require';
      const masked = maskConnectionString(input);
      expect(masked).not.toContain('superSecretPass123!');
      expect(masked).toContain('fastify_runtime:***@');
    });

    it('handles malformed database URLs without throwing and masks credentials', () => {
      const input = 'postgres://admin:pass@broken-host';
      const masked = maskConnectionString(input);
      expect(masked).not.toContain('pass');
    });

    it('sanitizes sensitive strings containing database URLs and passwords', () => {
      const errMsg = 'Error connecting to postgres://fastify_runtime:mySecretPassword@db.supabase.co:5432/postgres: timeout';
      const sanitized = sanitizeSensitiveString(errMsg);
      expect(sanitized).not.toContain('mySecretPassword');
      expect(sanitized).toContain('postgres://fastify_runtime:***@');
    });

    it('sanitizes sensitive query params and bearer tokens', () => {
      const msg = 'Request failed with ?password=secretPass123 and Authorization Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.dummy';
      const sanitized = sanitizeSensitiveString(msg);
      expect(sanitized).not.toContain('secretPass123');
      expect(sanitized).not.toContain('Bearer eyJ');
    });
  });

  describe('2. TLS Certificate Resolution', () => {
    let originalCa: string | undefined;

    beforeEach(() => {
      originalCa = process.env.DATABASE_SSL_CA;
      delete process.env.DATABASE_SSL_CA;
    });

    afterEach(() => {
      if (originalCa !== undefined) {
        process.env.DATABASE_SSL_CA = originalCa;
      } else {
        delete process.env.DATABASE_SSL_CA;
      }
    });

    it('returns undefined when CA is not provided', () => {
      expect(resolveSslCa(undefined)).toBeUndefined();
      expect(resolveSslCa('')).toBeUndefined();
      expect(resolveSslCa('   ')).toBeUndefined();
    });

    it('unescapes newlines for inline PEM string', () => {
      const rawPem = '-----BEGIN CERTIFICATE-----\\nMIIB...\\n-----END CERTIFICATE-----';
      const resolved = resolveSslCa(rawPem);
      expect(resolved).toBe('-----BEGIN CERTIFICATE-----\nMIIB...\n-----END CERTIFICATE-----');
    });

    it('reads certificate from existing filesystem path', () => {
      const tmpPath = path.resolve(process.cwd(), 'temp_test_ca.crt');
      fs.writeFileSync(tmpPath, '-----BEGIN CERTIFICATE-----\nTEST_CERT\n-----END CERTIFICATE-----');
      try {
        const resolved = resolveSslCa(tmpPath);
        expect(resolved).toBe('-----BEGIN CERTIFICATE-----\nTEST_CERT\n-----END CERTIFICATE-----');
      } finally {
        fs.unlinkSync(tmpPath);
      }
    });

    it('reports missing mounted CA files explicitly without disclosing the path', () => {
      expect(() => resolveSslCa('/missing/private-certificate.crt')).toThrow(/configured file was not found/);
    });

    it.each(['require', 'verify-full', 'no-verify', 'disable'])('preserves CA and strict verification through the pg driver with sslmode=%s', (mode) => {
      process.env.DATABASE_SSL_CA = rootCertificates[0].replace(/\n/g, '\\n');
      const config = parseDatabaseConfig(`postgres://user:secret@remote.example/db?sslmode=${mode}&application_name=staging`);
      const client = new pg.Client(config);
      // Check what the real driver will use, rather than only our config object.
      const effective = (client as any).connectionParameters;
      expect(effective.ssl.ca).toBe(rootCertificates[0]);
      expect(effective.ssl.rejectUnauthorized).toBe(true);
      expect(effective.application_name).toBe('staging');
    });

    it('preserves strict TLS for bracketed pooler credentials', () => {
      process.env.DATABASE_SSL_CA = rootCertificates[0];
      const config = parseDatabaseConfig('postgres://fastify_runtime.project:[pass@word]@remote.example:5432/postgres?sslmode=no-verify');
      const effective = (new pg.Client(config) as any).connectionParameters;
      expect(effective.password).toBe('pass@word');
      expect(effective.ssl).toEqual({ ca: rootCertificates[0], rejectUnauthorized: true });
    });

    it('does not mistake localhost in credentials for a local database', () => {
      expect(getDatabaseSslConfig('postgres://localhost:pass@remote.example/db')).toEqual({ rejectUnauthorized: true });
    });

    it('returns identical safe metadata for mounted and escaped inline certificates', () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'staging-ca-'));
      const file = path.join(dir, 'root.crt');
      fs.writeFileSync(file, rootCertificates[0]);
      try {
        process.env.DATABASE_SSL_CA = file;
        const mounted = getDatabaseTlsDiagnostics(parseDatabaseConfig('postgres://user:privatePassword@remote.example/db'));
        process.env.DATABASE_SSL_CA = rootCertificates[0].replace(/\n/g, '\\n');
        const inline = getDatabaseTlsDiagnostics(parseDatabaseConfig('postgres://user:privatePassword@remote.example/db'));
        expect(inline).toEqual(mounted);
        expect(inline).toMatchObject({ caLoaded: true, rejectUnauthorized: true });
        expect(inline.fingerprint256).toMatch(/^[0-9A-F:]+$/);
        expect(JSON.stringify(inline)).not.toMatch(/privatePassword|BEGIN CERTIFICATE|postgres:\/\//);
      } finally {
        fs.rmSync(dir, { recursive: true });
      }
    });

    it('rejects malformed certificate contents before connecting', () => {
      process.env.DATABASE_SSL_CA = '-----BEGIN CERTIFICATE-----\nBROKEN\n-----END CERTIFICATE-----';
      expect(() => getDatabaseTlsDiagnostics(parseDatabaseConfig('postgres://user:pass@remote.example/db'))).toThrow(/invalid PEM certificate/);
    });

    it('enforces rejectUnauthorized: true on remote URLs', () => {
      const remoteUrl = 'postgres://user:pass@remote.supabase.co:6543/postgres';
      const ssl = getDatabaseSslConfig(remoteUrl);
      expect(ssl).toEqual({ rejectUnauthorized: true });
    });

    it('allows undefined SSL for localhost without CA', () => {
      const localUrl = 'postgres://user:pass@localhost:5432/postgres';
      const ssl = getDatabaseSslConfig(localUrl);
      expect(ssl).toBeUndefined();
    });

    it('applies CA to localhost when CA is explicitly provided', () => {
      const localUrl = 'postgres://user:pass@localhost:5432/postgres';
      const ssl = getDatabaseSslConfig(localUrl, '-----BEGIN CERTIFICATE-----\nLOCAL_CA\n-----END CERTIFICATE-----');
      expect(ssl).toEqual({
        rejectUnauthorized: true,
        ca: '-----BEGIN CERTIFICATE-----\nLOCAL_CA\n-----END CERTIFICATE-----',
      });
    });
  });

  describe('3. Preflight Fail-Closed Security Assertions', () => {
    it('fails closed when connected user is postgres', async () => {
      const mockClient: any = {
        query: async (sql: string) => {
          if (sql.includes('CURRENT_USER')) {
            return {
              rows: [{
                current_user: 'postgres',
                session_user: 'postgres',
                current_database: 'postgres',
              }],
            };
          }
          return { rows: [] };
        },
      };

      await expect(runPreflight(mockClient)).rejects.toThrow(/Connected as restricted administrator role 'postgres'/);
    });

    it('fails closed when role has rolbypassrls = true', async () => {
      const mockClient: any = {
        query: async (sql: string) => {
          if (sql.includes('CURRENT_USER')) {
            return {
              rows: [{
                current_user: 'fastify_runtime',
                session_user: 'fastify_runtime',
                current_database: 'postgres',
              }],
            };
          }
          if (sql.includes('pg_roles')) {
            return {
              rows: [{
                rolsuper: false,
                rolbypassrls: true,
                rolcreaterole: false,
                rolcreatedb: false,
              }],
            };
          }
          return { rows: [] };
        },
      };

      await expect(runPreflight(mockClient)).rejects.toThrow(/rolbypassrls=true. Row Level Security bypass prohibited/);
    });

    it('fails closed when role has rolsuper = true', async () => {
      const mockClient: any = {
        query: async (sql: string) => {
          if (sql.includes('CURRENT_USER')) {
            return {
              rows: [{
                current_user: 'fastify_runtime',
                session_user: 'fastify_runtime',
                current_database: 'postgres',
              }],
            };
          }
          if (sql.includes('pg_roles')) {
            return {
              rows: [{
                rolsuper: true,
                rolbypassrls: false,
                rolcreaterole: false,
                rolcreatedb: false,
              }],
            };
          }
          return { rows: [] };
        },
      };

      await expect(runPreflight(mockClient)).rejects.toThrow(/rolsuper=true. Least privilege violated/);
    });

    it('fails closed when role is not a member of authenticated', async () => {
      const mockClient: any = {
        query: async (sql: string) => {
          if (sql.includes('CURRENT_USER')) {
            return {
              rows: [{
                current_user: 'fastify_runtime',
                session_user: 'fastify_runtime',
                current_database: 'postgres',
              }],
            };
          }
          if (sql.includes('pg_roles')) {
            return {
              rows: [{
                rolsuper: false,
                rolbypassrls: false,
                rolcreaterole: false,
                rolcreatedb: false,
              }],
            };
          }
          if (sql.includes('pg_has_role')) {
            return {
              rows: [{ is_member: false }],
            };
          }
          return { rows: [] };
        },
      };

      await expect(runPreflight(mockClient)).rejects.toThrow(/not a member of 'authenticated'/);
    });

    it('fails closed when role has rolcreaterole = true', async () => {
      const mockClient: any = {
        query: async (sql: string) => {
          if (sql.includes('CURRENT_USER')) {
            return {
              rows: [{
                current_user: 'fastify_runtime',
                session_user: 'fastify_runtime',
                current_database: 'postgres',
              }],
            };
          }
          if (sql.includes('pg_roles')) {
            return {
              rows: [{
                rolsuper: false,
                rolbypassrls: false,
                rolcreaterole: true,
                rolcreatedb: false,
              }],
            };
          }
          return { rows: [] };
        },
      };

      await expect(runPreflight(mockClient)).rejects.toThrow(/rolcreaterole=true. Role creation privilege prohibited/);
    });

    it('fails closed when role has rolcreatedb = true', async () => {
      const mockClient: any = {
        query: async (sql: string) => {
          if (sql.includes('CURRENT_USER')) {
            return {
              rows: [{
                current_user: 'fastify_runtime',
                session_user: 'fastify_runtime',
                current_database: 'postgres',
              }],
            };
          }
          if (sql.includes('pg_roles')) {
            return {
              rows: [{
                rolsuper: false,
                rolbypassrls: false,
                rolcreaterole: false,
                rolcreatedb: true,
              }],
            };
          }
          return { rows: [] };
        },
      };

      await expect(runPreflight(mockClient)).rejects.toThrow(/rolcreatedb=true. Database creation privilege prohibited/);
    });

    it('fails closed when role has CREATE privilege on schema public', async () => {
      const mockClient: any = {
        query: async (sql: string) => {
          if (sql.includes('CURRENT_USER')) {
            return {
              rows: [{
                current_user: 'fastify_runtime',
                session_user: 'fastify_runtime',
                current_database: 'postgres',
              }],
            };
          }
          if (sql.includes('pg_roles')) {
            return {
              rows: [{
                rolsuper: false,
                rolbypassrls: false,
                rolcreaterole: false,
                rolcreatedb: false,
              }],
            };
          }
          if (sql.includes('pg_has_role')) {
            return { rows: [{ is_member: true }] };
          }
          if (sql.includes('public_usage')) {
            return { rows: [{ public_usage: true }] };
          }
          if (sql.includes('public_create')) {
            return { rows: [{ public_create: true }] };
          }
          return { rows: [] };
        },
      };

      await expect(runPreflight(mockClient)).rejects.toThrow(/prohibited CREATE privilege on schema 'public'/);
    });

    it('fails closed when role has SELECT privilege on table auth.users', async () => {
      const mockClient: any = {
        query: async (sql: string) => {
          if (sql.includes('CURRENT_USER')) {
            return {
              rows: [{
                current_user: 'fastify_runtime',
                session_user: 'fastify_runtime',
                current_database: 'postgres',
              }],
            };
          }
          if (sql.includes('pg_roles')) {
            return {
              rows: [{
                rolsuper: false,
                rolbypassrls: false,
                rolcreaterole: false,
                rolcreatedb: false,
              }],
            };
          }
          if (sql.includes('pg_has_role')) {
            return { rows: [{ is_member: true }] };
          }
          if (sql.includes('public_usage')) {
            return { rows: [{ public_usage: true }] };
          }
          if (sql.includes('public_create')) {
            return { rows: [{ public_create: false }] };
          }
          if (sql.includes('auth.users')) {
            return {
              rows: [{
                has_auth_users: true,
                can_select: true,
                can_insert: false,
                can_update: false,
                can_delete: false,
              }],
            };
          }
          return { rows: [] };
        },
      };

      await expect(runPreflight(mockClient)).rejects.toThrow(/prohibited direct table privilege\(s\) \[SELECT\] on 'auth\.users'/);
    });

    it('fails closed when role has INSERT, UPDATE, or DELETE on table auth.users', async () => {
      for (const priv of ['INSERT', 'UPDATE', 'DELETE'] as const) {
        const mockClient: any = {
          query: async (sql: string) => {
            if (sql.includes('CURRENT_USER')) {
              return {
                rows: [{
                  current_user: 'fastify_runtime',
                  session_user: 'fastify_runtime',
                  current_database: 'postgres',
                }],
              };
            }
            if (sql.includes('pg_roles')) {
              return {
                rows: [{
                  rolsuper: false,
                  rolbypassrls: false,
                  rolcreaterole: false,
                  rolcreatedb: false,
                }],
              };
            }
            if (sql.includes('pg_has_role')) {
              return { rows: [{ is_member: true }] };
            }
            if (sql.includes('public_usage')) {
              return { rows: [{ public_usage: true }] };
            }
            if (sql.includes('public_create')) {
              return { rows: [{ public_create: false }] };
            }
            if (sql.includes('auth.users')) {
              return {
                rows: [{
                  has_auth_users: true,
                  can_select: false,
                  can_insert: priv === 'INSERT',
                  can_update: priv === 'UPDATE',
                  can_delete: priv === 'DELETE',
                }],
              };
            }
            return { rows: [] };
          },
        };

        await expect(runPreflight(mockClient)).rejects.toThrow(
          new RegExp(`prohibited direct table privilege\\(s\\) \\[${priv}\\] on 'auth\\.users'`)
        );
      }
    });

    it('passes and returns positive report when all least privilege boundaries hold', async () => {
      const mockClient: any = {
        host: 'aws-0-ap-southeast-1.pooler.supabase.com',
        query: async (sql: string) => {
          if (sql.includes('CURRENT_USER')) {
            return {
              rows: [{
                current_user: 'fastify_runtime',
                session_user: 'fastify_runtime',
                current_database: 'postgres',
              }],
            };
          }
          if (sql.includes('pg_roles')) {
            return {
              rows: [{
                rolsuper: false,
                rolbypassrls: false,
                rolcreaterole: false,
                rolcreatedb: false,
              }],
            };
          }
          if (sql.includes('pg_has_role')) {
            return { rows: [{ is_member: true }] };
          }
          if (sql.includes('public_usage')) {
            return { rows: [{ public_usage: true }] };
          }
          if (sql.includes('public_create')) {
            return { rows: [{ public_create: false }] };
          }
          if (sql.includes('auth.users')) {
            return {
              rows: [{
                has_auth_users: true,
                can_select: false,
                can_insert: false,
                can_update: false,
                can_delete: false,
              }],
            };
          }
          if (sql.includes('tenants_select')) {
            return { rows: [{ tenants_select: true }] };
          }
          if (sql.includes('CREATE TABLE public.__probe_boundary')) {
            const err: any = new Error('permission denied for schema public');
            err.code = '42501';
            throw err;
          }
          if (sql.includes('information_schema.schemata')) {
            return { rows: [{ schema_owner: 'postgres' }] };
          }
          if (sql.includes('pg_tables')) {
            return { rows: [{ count: '0' }] };
          }
          return { rows: [] };
        },
      };

      const report = await runPreflight(mockClient);
      expect(report.status).toBe('PASS');
      expect(report.publicSchemaCreateBlocked).toBe(true);
      expect(report.authUsersPrivilegesBlocked).toBe(true);
      expect(report.ddlBlocked).toBe(true);
      expect(report.schemaOwnershipSafe).toBe(true);
      expect(report.tableOwnershipSafe).toBe(true);
    });
  });
});
