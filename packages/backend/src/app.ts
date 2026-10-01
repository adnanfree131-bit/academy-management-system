import { createHmac } from 'node:crypto';
import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import rateLimit from '@fastify/rate-limit';
import fs from 'fs';
import path from 'path';
import { IDataStore } from './services/store.js';
import { PostgresDataStore } from './services/postgres-store.js';
import { IMailerService, createMailerService } from './services/mailer.js';
import { ICloudflareService } from './services/cloudflare.js';
import { User } from '@apex/shared-types';
import { resolveUserAccess } from './lib/access.js';
import { authRoutes } from './routes/auth.js';
import { academicRoutes } from './routes/academic.js';
import { sisRoutes } from './routes/sis.js';
import { timetableRoutes } from './routes/timetable.js';
import { attendanceRoutes } from './routes/attendance.js';
import { geofenceRoutes } from './routes/geofence.js';
import { homeworkRoutes } from './routes/homework.js';
import { complaintsRoutes } from './routes/complaints.js';
import { financeRoutes } from './routes/finance.js';
import { payrollRoutes } from './routes/payroll.js';
import { examRoutes } from './routes/exams.js';
import { whatsappRoutes } from './routes/whatsapp.js';
import { absenteeRoutes } from './routes/absentee.js';
import { saasRoutes } from './routes/saas.js';
import { portalRoutes } from './routes/portal.js';

import { validateAuthConfig } from './config/env.js';
import { defaultJwtVerifier, IJwtVerifier, SupabaseJwtClaims } from './lib/jwt-verifier.js';
import { getDatabasePool, verifyDatabaseConnection } from './db/connection.js';
import { normalizeEffectiveHostname, resolveHostTenant } from './lib/tenant-resolver.js';
import { dbContextStorage, DatabaseRequestContext } from './db/context.js';

export interface AppOptions {
  store?: IDataStore;
  mailer?: IMailerService;
  jwtSecret?: string; // Deprecated, ignored in production
  jwtVerifier?: IJwtVerifier;
  pool?: any;
  cloudflare?: ICloudflareService;
}

export function sanitizeSensitiveString(text: string): string {
  if (!text || typeof text !== 'string') return text;
  return text
    // Mask passwords in database connection strings (postgres://user:pass@host:port/db)
    .replace(/((?:postgres|postgresql):\/\/[^:\s\/]+:)[^@\s\/]+(@)/gi, '$1***$2')
    // Mask URL parameters like password, token, key, secret
    .replace(/([?&](?:password|token|secret|apiKey|api_key|service_role_key)=)[^&]+/gi, '$1***')
    // Mask Authorization header values
    .replace(/(Bearer\s+)[A-Za-z0-9\-._~+/]+=*/gi, '$1***')
    // Mask standalone JWT tokens
    .replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, '[REDACTED_JWT]');
}

export async function buildApp(options: AppOptions = {}): Promise<FastifyInstance> {
  const authConfig = validateAuthConfig();
  const isProduction = process.env.NODE_ENV === 'production';

  // Production fail-closed guarantee: verify PostgreSQL connectivity
  if (isProduction || !options.store) {
    try {
      await verifyDatabaseConnection();
    } catch (err: any) {
      throw new Error(`FATAL: Production database connection failed. Application fails closed: ${err.message}`);
    }
  }

  // PostgreSQL is the exclusive production application data store.
  // InMemoryDataStore is strictly prohibited in production and reserved as a test fixture.
  if (isProduction && options.store && !(options.store instanceof PostgresDataStore)) {
    throw new Error('FATAL: Production database connection failed. InMemoryDataStore is strictly prohibited in production.');
  }
  const store = options.store || new PostgresDataStore(getDatabasePool());
  const mailer = options.mailer || createMailerService();
  const jwtVerifier = options.jwtVerifier || defaultJwtVerifier;

  const pool = options.pool !== undefined
    ? options.pool
    : (options.store ? ((options.store as any).pool || null) : getDatabasePool());

  const fastify = Fastify({
    logger: process.env.NODE_ENV === 'test' ? false : {
      level: process.env.LOG_LEVEL || 'info',
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers["x-tenant-id"]',
          'headers.authorization',
          'body.password',
          'body.token',
          'body.raw_token',
          'body.otp',
          'body.refresh_token',
          'body.access_token',
          'body.card_number',
          'body.cvv',
          '*.token',
          '*.raw_token',
          '*.password',
          '*.secret',
        ],
        censor: '[REDACTED]',
      },
    },
    bodyLimit: 2097152, // 2MB cap to prevent OOM on 512MB RAM container
  });

  // Support empty JSON bodies gracefully without FST_ERR_CTP_EMPTY_JSON_BODY
  fastify.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
    if (!body || (typeof body === 'string' && body.trim() === '')) {
      done(null, {});
      return;
    }
    try {
      const json = JSON.parse(body as string);
      done(null, json);
    } catch (err: any) {
      err.statusCode = 400;
      done(err, undefined);
    }
  });

  // Rate Limiting Plugin
  await fastify.register(rateLimit, {
    global: false,
    hook: 'onRequest',
    cache: 10000,
    errorResponseBuilder: (_req, context) => ({
      statusCode: 429,
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: `Too many requests. Please retry in ${Math.ceil(context.ttl / 1000)} seconds.`,
      },
      timestamp: new Date().toISOString(),
    }),
  });

  // Plugins
  const configuredOrigins = new Set(
    String(process.env.CORS_ALLOWED_ORIGINS || '')
      .split(',')
      .map(origin => origin.trim())
      .filter(Boolean)
  );
  const baseDomain = String(process.env.BASE_DOMAIN || '').trim().toLowerCase();
  await fastify.register(cors, {
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (process.env.NODE_ENV !== 'production' && configuredOrigins.size === 0) return callback(null, true);
      if (configuredOrigins.has(origin)) return callback(null, true);
      try {
        const hostname = new URL(origin).hostname.toLowerCase();
        const protocolAllowed = process.env.NODE_ENV !== 'production' || new URL(origin).protocol === 'https:';
        if (protocolAllowed && baseDomain && (hostname === baseDomain || hostname.endsWith(`.${baseDomain}`))) {
          return callback(null, true);
        }
      } catch {
        // Invalid origins are rejected below.
      }
      return callback(null, false);
    },
    credentials: true,
  });

  fastify.addHook('onSend', async (_request, reply, payload) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Referrer-Policy', 'no-referrer');
    reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    reply.header('Content-Security-Policy', "default-src 'self'; frame-ancestors 'none'; object-src 'none'");
    if (process.env.NODE_ENV === 'production') {
      reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    return payload;
  });

  await fastify.register(sensible);

  // Centralized Error Sanitizer: Redact connection strings, passwords, and sensitive tokens
  fastify.setErrorHandler((error: any, request, reply) => {
    if (reply.sent) return;

    const statusCode = error.statusCode && error.statusCode >= 400 && error.statusCode < 600
      ? error.statusCode
      : (error.status && error.status >= 400 && error.status < 600 ? error.status : 500);

    const rawMessage = error.error?.message || error.message || 'Internal Server Error';
    const sanitizedMessage = sanitizeSensitiveString(rawMessage);

    if (request.log && typeof request.log.error === 'function') {
      request.log.error({
        err: {
          message: sanitizedMessage,
          code: error.error?.code || error.code,
          statusCode,
        },
        reqId: request.id,
      }, 'Request handling error');
    }

    const isClientError = statusCode < 500;
    const clientMessage = (isClientError || error.code === 'COMMIT_FAILED' || error.code === 'DATABASE_UNAVAILABLE')
      ? sanitizedMessage
      : (process.env.NODE_ENV === 'production' ? 'Internal server error occurred.' : sanitizedMessage);

    const errorCode = error.error?.code || error.code || (statusCode === 429 ? 'RATE_LIMIT_EXCEEDED' : (statusCode === 500 ? 'INTERNAL_SERVER_ERROR' : 'ERROR'));

    reply.status(statusCode).send({
      success: false,
      error: {
        code: errorCode,
        message: clientMessage,
      },
      timestamp: new Date().toISOString(),
    });
  });

  // Request-scoped database transaction context & RLS lifecycle
  fastify.addHook('onRequest', (request: any, _reply, done) => {
    const reqContext: DatabaseRequestContext = { client: undefined };
    request.dbContext = reqContext;
    request.dbClient = null;
    request.dbClientReleased = false;
    dbContextStorage.run(reqContext, () => {
      done();
    });
  });

  // Early Commit before response finalization: commit for success, rollback for >= 400
  fastify.addHook('onSend', async (request: any, reply: any, payload: any) => {
    if (request.dbClient && !request.dbClientReleased) {
      const executeLifecycle = async () => {
        if (reply.statusCode < 400) {
          try {
            await request.dbClient.query('COMMIT');
            (request.dbClient as any).__in_transaction = false;
            (request.dbClient as any).__tx_depth = 0;
            try { request.dbClient.release(); } catch {}
            request.dbClientReleased = true;
            request.dbClient = null;
            if (request.dbContext) request.dbContext.client = undefined;
          } catch (commitErr: any) {
            try {
              await request.dbClient.query('ROLLBACK');
            } catch {}
            (request.dbClient as any).__in_transaction = false;
            (request.dbClient as any).__tx_depth = 0;
            try { request.dbClient.release(); } catch {}
            request.dbClientReleased = true;
            request.dbClient = null;
            if (request.dbContext) request.dbContext.client = undefined;

            const err: any = new Error('Database transaction commit failed.');
            err.statusCode = 503;
            err.code = 'COMMIT_FAILED';
            throw err;
          }
        } else {
          try {
            await request.dbClient.query('ROLLBACK');
          } catch {}
          (request.dbClient as any).__in_transaction = false;
          (request.dbClient as any).__tx_depth = 0;
          try { request.dbClient.release(); } catch {}
          request.dbClientReleased = true;
          request.dbClient = null;
          if (request.dbContext) request.dbContext.client = undefined;
        }
      };

      if (request.dbContext) {
        await dbContextStorage.run(request.dbContext, executeLifecycle);
      } else {
        await executeLifecycle();
      }
    }
    return payload;
  });

  fastify.addHook('onError', async (request: any, _reply: any, _error: any) => {
    if (request.dbClient && !request.dbClientReleased) {
      request.dbClientReleased = true;
      try {
        await request.dbClient.query('ROLLBACK');
      } catch {
      } finally {
        (request.dbClient as any).__in_transaction = false;
        (request.dbClient as any).__tx_depth = 0;
        try { request.dbClient.release(); } catch {}
        request.dbClient = null;
        if (request.dbContext) request.dbContext.client = undefined;
      }
    }
  });

  fastify.addHook('onResponse', async (request: any, _reply: any) => {
    if (request.dbClient && !request.dbClientReleased) {
      request.dbClientReleased = true;
      try {
        await request.dbClient.query('ROLLBACK');
      } catch {
      } finally {
        (request.dbClient as any).__in_transaction = false;
        (request.dbClient as any).__tx_depth = 0;
        try { request.dbClient.release(); } catch {}
        request.dbClient = null;
        if (request.dbContext) request.dbContext.client = undefined;
      }
    }
  });

  // Decorate fastify with Supabase Auth token verification & tenant context boundary
  fastify.decorate('authenticate', async function (request: any, reply: any) {
    const authHeader = (request.headers.authorization || request.headers.Authorization) as string | undefined;
    if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Valid authorization token required.' },
        timestamp: new Date().toISOString(),
      });
    }

    const rawToken = authHeader.slice(7).trim();
    if (!rawToken) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Valid authorization token required.' },
        timestamp: new Date().toISOString(),
      });
    }

    let claims: any;
    try {
      claims = await jwtVerifier.verify(rawToken);
    } catch (err: any) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: err?.message || 'Valid authorization token required.' },
        timestamp: new Date().toISOString(),
      });
    }

    const authUserId = String(claims?.sub || claims?.user_id || '');
    const tokenEmail = (claims?.email as string | undefined)?.toLowerCase();

    // Check out request-scoped DB client from pool and begin transaction with RLS context
    if (pool && typeof (pool as any)?.connect === 'function' && !request.dbClient) {
      let client: any = null;
      try {
        client = await (pool as any).connect();
        request.dbClient = client;
        request.dbClientReleased = false;
        (client as any).__in_transaction = true;
        (client as any).__tx_depth = 1;
        if (request.dbContext) {
          request.dbContext.client = client;
          request.dbContext.authUserId = authUserId;
        }
        await client.query('BEGIN');
        await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [authUserId]);
      } catch (dbInitErr: any) {
        if (client) {
          try { await client.query('ROLLBACK'); } catch {}
          try { client.release(); } catch {}
        }
        request.dbClient = null;
        request.dbClientReleased = true;
        if (request.dbContext) {
          request.dbContext.client = undefined;
        }
        return reply.status(503).send({
          success: false,
          error: {
            code: 'DATABASE_UNAVAILABLE',
            message: 'Database initialization failed. Please retry your request.',
          },
          timestamp: new Date().toISOString(),
        });
      }
    }

    // 1. Resolve Profile from auth identity
    let profile = await store.getProfileByAuthId(authUserId);
    if (!profile && tokenEmail) {
      profile = await store.getProfileByEmail(tokenEmail);
    }
    if (!profile) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'User account no longer exists.' },
        timestamp: new Date().toISOString(),
      });
    }

    // Profile active check
    if (profile.status !== 'active') {
      const errorCode = profile.status === 'archived' ? 'ACCOUNT_ARCHIVED' : 'ACCOUNT_NOT_ACTIVE';
      return reply.status(403).send({
        success: false,
        error: {
          code: errorCode,
          message: `Your account access has been revoked (status: ${profile.status}).`,
        },
        timestamp: new Date().toISOString(),
      });
    }

    // 2. Hostname Normalization & Tenant Boundary Resolution (Phase 5)
    const effectiveHost = normalizeEffectiveHostname(request);
    const hostResolution = await resolveHostTenant(effectiveHost, request.dbClient || pool || getDatabasePool(), store);

    if (hostResolution.isUnmapped) {
      return reply.status(404).send({
        success: false,
        error: {
          code: 'UNMAPPED_HOST',
          message: `Host '${effectiveHost}' is not associated with an active academy.`,
        },
        timestamp: new Date().toISOString(),
      });
    }

    const explicitHeaderTenantId = (request.headers['x-tenant-id'] ||
      request.headers['X-Tenant-ID'] ||
      (process.env.NODE_ENV === 'test' ? claims?.tenant_id : undefined)) as string | undefined;

    let targetTenantId: string | undefined;

    if (hostResolution.isBrandedHost) {
      targetTenantId = hostResolution.tenantId || undefined;

      // On branded domains, reject any tenant ID header that differs from the hostname's tenant
      if (explicitHeaderTenantId && explicitHeaderTenantId !== targetTenantId) {
        return reply.status(403).send({
          success: false,
          error: {
            code: 'TENANT_HOST_MISMATCH',
            message: `Cross-tenant access prohibited. Host '${effectiveHost}' is strictly bound to its own academy.`,
          },
          timestamp: new Date().toISOString(),
        });
      }
    } else {
      // Central platform host: resolve tenant from X-Tenant-ID header
      targetTenantId = explicitHeaderTenantId;
    }

    let tenant: any = null;
    let membership: any = null;

    if (request.dbClient && !request.dbClientReleased) {
      try {
        if (profile?.platform_role === 'super_admin') {
          await request.dbClient.query(`SELECT set_config('app.is_super_admin', 'true', true)`);
          if (request.dbContext) request.dbContext.isSuperAdmin = true;
        }
        if (targetTenantId) {
          await request.dbClient.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [targetTenantId]);
          if (request.dbContext) request.dbContext.tenantId = targetTenantId;
        }
        await request.dbClient.query('SET LOCAL ROLE authenticated');
      } catch (dbTenantErr: any) {
        if (request.dbClient && !request.dbClientReleased) {
          request.dbClientReleased = true;
          try { await request.dbClient.query('ROLLBACK'); } catch {}
          try { request.dbClient.release(); } catch {}
          request.dbClient = null;
        }
        if (request.dbContext) {
          request.dbContext.client = undefined;
        }
        return reply.status(503).send({
          success: false,
          error: {
            code: 'DATABASE_UNAVAILABLE',
            message: 'Failed to bind tenant context to database transaction.',
          },
          timestamp: new Date().toISOString(),
        });
      }
    }

    if (targetTenantId) {
      tenant = await store.getTenantById(targetTenantId);
      if (!tenant) {
        return reply.status(404).send({
          success: false,
          error: { code: 'TENANT_NOT_FOUND', message: 'Academy does not exist.' },
          timestamp: new Date().toISOString(),
        });
      }

      // Role-segregated academy suspension check
      if (tenant.status === 'suspended' && profile.platform_role !== 'super_admin') {
        const url = request.url || '';
        const isAllowedBillingPath =
          url.includes('/saas/trial-status') ||
          url.includes('/saas/receipts') ||
          url.includes('/saas/banking-config') ||
          url.includes('/saas/my-academy') ||
          url.includes('/auth/me') ||
          url.includes('/tenant/active-popup');

        membership = await store.getMembership(targetTenantId, authUserId);
        if (!membership && tokenEmail) {
          membership = await store.getMembership(targetTenantId, tokenEmail);
        }

        if (membership?.role === 'tenant_admin' && isAllowedBillingPath) {
          // Allow tenant_admin restricted access to billing settlement desk
        } else {
          return reply.status(403).send({
            success: false,
            error: {
              code: 'ACADEMY_SUSPENDED',
              message: 'This academy has been suspended by the platform administrator. Please contact billing support.',
              tenant_name: tenant.name,
              suspended_reason: tenant.suspended_reason || 'Administrative hold',
            },
            timestamp: new Date().toISOString(),
          });
        }
      }

      if (!membership) {
        membership = await store.getMembership(targetTenantId, authUserId);
        if (!membership && tokenEmail) {
          membership = await store.getMembership(targetTenantId, tokenEmail);
        }
      }

      // Tenant isolation: caller MUST have an active membership in this tenant unless platform super_admin
      if (!membership && profile.platform_role !== 'super_admin') {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'User does not belong to this academy.' },
          timestamp: new Date().toISOString(),
        });
      }

      // Membership active status check
      if (membership && membership.status !== 'active') {
        const errorCode = membership.status === 'archived' ? 'ACCOUNT_ARCHIVED' : 'ACCOUNT_NOT_ACTIVE';
        return reply.status(403).send({
          success: false,
          error: {
            code: errorCode,
            message: `Your account access has been revoked (status: ${membership.status}). Please contact academy administration.`,
          },
          timestamp: new Date().toISOString(),
        });
      }

      // Portal blocked restriction
      const portalBlocked = Boolean((membership?.metadata as any)?.portal_blocked);
      if (portalBlocked) {
        const reqPath = (request.url || '').split('?')[0];
        const isAllowedPortalPath =
          reqPath.endsWith('/change-password') ||
          reqPath.endsWith('/session') ||
          reqPath.endsWith('/me') ||
          reqPath.endsWith('/logout');
        if (!isAllowedPortalPath) {
          return reply.status(403).send({
            success: false,
            error: {
              code: 'PORTAL_BLOCKED',
              message: 'Student portal access has been blocked by the academy.',
            },
            timestamp: new Date().toISOString(),
          });
        }
      }
    } else {
      // Header missing: Check if route is platform route or bootstrap session
      const reqPath = (request.url || '').split('?')[0];
      const isPlatformOrBootstrap =
        reqPath.includes('/saas/') ||
        reqPath.endsWith('/health') ||
        reqPath.endsWith('/session') ||
        reqPath.endsWith('/me') ||
        reqPath.endsWith('/onboard-tenant') ||
        reqPath.endsWith('/invitations/accept') ||
        /\/invitations\/[^/]+\/accept$/.test(reqPath);

      if (profile.platform_role !== 'super_admin' && !isPlatformOrBootstrap) {
        return reply.status(400).send({
          success: false,
          error: { code: 'TENANT_REQUIRED', message: 'X-Tenant-ID header is required for tenant operations.' },
          timestamp: new Date().toISOString(),
        });
      }
    }

    const liveRole = membership?.role || (profile.platform_role === 'super_admin' ? 'super_admin' : 'tenant_admin');
    const liveAccess = membership ? resolveUserAccess(membership) : {};
    const teachingAssignments = Array.isArray(membership?.metadata?.teaching_assignments)
      ? membership.metadata.teaching_assignments
      : [];

    const headerSession = (request.headers['x-kampus-session'] || request.headers['X-Kampus-Session']) as string | undefined;
    const workingSession = targetTenantId
      ? store.resolveWorkingSession(targetTenantId, (membership || {}) as User, headerSession)
      : '2026-2027';
    const yearClosed = targetTenantId
      ? store.isYearClosed(targetTenantId, workingSession)
      : false;

    request.working_session = workingSession;
    request.year_closed = yearClosed;
    request.tenant = tenant;
    request.membership = membership;
    request.hostResolution = hostResolution;

    request.auth = {
      user_id: authUserId,
      email: tokenEmail || profile.email,
      profile,
      aal: claims?.aal || 'aal1',
      claims,
    };

    request.user = {
      ...claims,
      id: membership?.id || authUserId,
      sub: membership?.id || authUserId,
      user_id: membership?.id || authUserId,
      auth_user_id: authUserId,
      tenant_id: targetTenantId,
      email: membership?.email || tokenEmail || profile.email,
      role: liveRole,
      status: membership?.status || profile.status,
      access: liveAccess,
      teaching_assignments: teachingAssignments,
      portal_blocked: Boolean((membership?.metadata as any)?.portal_blocked),
      working_session: workingSession,
      year_closed: yearClosed,
      aal: claims?.aal || 'aal1',
    };
  });

  if (process.env.NODE_ENV === 'test') {
    fastify.decorate('jwt', {
      sign: (payload: any) => {
        const config = validateAuthConfig();
        const secret = process.env.TEST_JWT_SECRET || 'test-jwt-secret-key-at-least-32-chars-long';
        const issuer = config.supabaseJwtIssuer;
        const audience = config.supabaseJwtAudience;
        const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
        const body = Buffer.from(
          JSON.stringify({
            ...payload,
            sub: payload.sub || payload.user_id || 'test-user',
            iss: payload.iss || issuer,
            aud: payload.aud || audience,
            exp: payload.exp || Math.floor(Date.now() / 1000) + 7200,
            iat: payload.iat || Math.floor(Date.now() / 1000),
          })
        ).toString('base64url');
        const sig = createHmac('sha256', secret).update(header + '.' + body).digest('base64url');
        return `${header}.${body}.${sig}`;
      },
      decode: (token: string) => {
        try {
          const parts = token.split('.');
          if (parts.length >= 2) {
            return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
          }
        } catch {
          return null;
        }
        return null;
      },
    });
  }

  // Dedicated platform super admin guard
  fastify.decorate('requirePlatformAdmin', async function (request: any, reply: any) {
    const isSuperAdmin =
      request.auth?.profile?.platform_role === 'super_admin' ||
      request.user?.role === 'super_admin';

    if (!isSuperAdmin) {
      return reply.status(403).send({
        success: false,
        error: {
          code: 'FORBIDDEN_ROLE',
          message: 'Access denied. Platform super administrator privileges required.',
        },
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Dedicated MFA (aal2) guard for high-risk operations
  fastify.decorate('requireMFA', async function (request: any, reply: any) {
    const aal = request.auth?.aal || request.user?.aal;
    if (aal !== 'aal2') {
      return reply.status(403).send({
        success: false,
        error: {
          code: 'MFA_REQUIRED',
          message: 'Authenticator assurance level 2 (MFA) required for this high-risk operation.',
        },
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Decorate fastify with role-based access control preHandler
  fastify.decorate('requireRole', function (allowedRoles: string[]) {
    return async function (request: any, reply: any) {
      const user = request.user;
      if (!user || (!allowedRoles.includes(user.role) && user.role !== 'super_admin')) {
        return reply.status(403).send({
          success: false,
          error: {
            code: 'FORBIDDEN_ROLE',
            message: `Access denied. Role '${user?.role || 'unknown'}' is not authorized for this operation.`,
          },
          timestamp: new Date().toISOString(),
        });
      }
    };
  });

  // Health Route
  fastify.get('/api/v1/health', async (_req, _reply) => {
    return {
      status: 'healthy',
      version: '1.0.0',
      system: 'Academy Management System Backend',
      timestamp: new Date().toISOString(),
    };
  });

  // Brand Logo Assets (for email clients and platform CDN)
  fastify.get('/kampus-logo-email.png', async (_req, reply) => {
    try {
      const candidates = [
        path.resolve(process.cwd(), 'public/kampus-logo-email.png'),
        path.resolve(process.cwd(), 'packages/backend/public/kampus-logo-email.png'),
        path.resolve(process.cwd(), 'packages/frontend/public/kampus-logo-email.png'),
        path.join(__dirname, '../public/kampus-logo-email.png'),
      ];
      for (const filePath of candidates) {
        if (fs.existsSync(filePath)) {
          const buffer = fs.readFileSync(filePath);
          return reply.type('image/png').header('Cache-Control', 'public, max-age=31536000, immutable').send(buffer);
        }
      }
    } catch (_e) {}
    return reply.status(404).send('Logo not found');
  });

  fastify.get('/kampus-logo.png', async (_req, reply) => {
    try {
      const candidates = [
        path.resolve(process.cwd(), 'public/kampus-logo.png'),
        path.resolve(process.cwd(), 'packages/backend/public/kampus-logo.png'),
        path.resolve(process.cwd(), 'packages/frontend/public/kampus-logo.png'),
        path.join(__dirname, '../public/kampus-logo.png'),
      ];
      for (const filePath of candidates) {
        if (fs.existsSync(filePath)) {
          const buffer = fs.readFileSync(filePath);
          return reply.type('image/png').header('Cache-Control', 'public, max-age=31536000, immutable').send(buffer);
        }
      }
    } catch (_e) {}
    return reply.status(404).send('Logo not found');
  });

  // Auth Routes
  await fastify.register(authRoutes(store, mailer, options.cloudflare), { prefix: '/api/v1/auth' });

  // Academic & SIS Routes
  await fastify.register(academicRoutes(store), { prefix: '/api/v1/academic' });
  await fastify.register(sisRoutes(store), { prefix: '/api/v1/sis' });

  // Phase 3 Routes: Timetable, Attendance, Geofencing, Homework & Complaints
  await fastify.register(timetableRoutes(store), { prefix: '/api/v1/timetable' });
  await fastify.register(attendanceRoutes(store), { prefix: '/api/v1/attendance' });
  await fastify.register(geofenceRoutes(store), { prefix: '/api/v1/geofence' });
  await fastify.register(homeworkRoutes(store), { prefix: '/api/v1/homework' });
  await fastify.register(complaintsRoutes(store), { prefix: '/api/v1/complaints' });

  // Phase 4 Routes: Finance, Multi-Head Vouchers & Staff Payroll
  await fastify.register(financeRoutes(store), { prefix: '/api/v1/finance' });
  await fastify.register(payrollRoutes(store), { prefix: '/api/v1/payroll' });

  // Phase 5 Routes: Examination Bank, Excel Chapter Upload & Hybrid Evaluation
  await fastify.register(examRoutes(store), { prefix: '/api/v1/exams' });

  // Phase 6 Routes: WhatsApp Direct Messaging Engine & Absentee Retention Desk
  await fastify.register(whatsappRoutes(store), { prefix: '/api/v1/whatsapp' });
  await fastify.register(absenteeRoutes(store), { prefix: '/api/v1/absentee' });

  // Phase 7 Routes: Multi-Portal Dashboards, SaaS Billing Lockout & Control Plane
  await fastify.register(saasRoutes(store), { prefix: '/api/v1/saas' });
  await fastify.register(portalRoutes(store), { prefix: '/api/v1/portal' });

  return fastify;
}
