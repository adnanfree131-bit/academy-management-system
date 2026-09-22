import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import sensible from '@fastify/sensible';
import fs from 'fs';
import path from 'path';
import { IDataStore, InMemoryDataStore } from './services/store.js';
import { IMailerService, createMailerService } from './services/mailer.js';
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

export interface AppOptions {
  store?: IDataStore;
  mailer?: IMailerService;
  jwtSecret?: string;
}

export async function buildApp(options: AppOptions = {}): Promise<FastifyInstance> {
  if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET && !options.jwtSecret) {
    throw new Error('FATAL: JWT_SECRET environment variable is required in production.');
  }

  const store = options.store || new InMemoryDataStore();
  if (!options.store && store instanceof InMemoryDataStore) {
    await store.hydrateFromDatabase();
  }
  const mailer = options.mailer || createMailerService();
  const jwtSecret = options.jwtSecret || process.env.JWT_SECRET || 'super-secret-default-dev-key-minimum-32-chars';

  const fastify = Fastify({
    logger: process.env.NODE_ENV === 'test' ? false : (process.env.NODE_ENV === 'production' ? true : true),
    bodyLimit: 2097152, // 2MB cap to prevent OOM on 512MB RAM container
  });

  // Plugins
  await fastify.register(cors, {
    origin: true,
    credentials: true,
  });

  await fastify.register(sensible);

  await fastify.register(fastifyJwt, {
    secret: jwtSecret,
  });

  // Decorate fastify with JWT authentication preHandler
  fastify.decorate('authenticate', async function (request: any, reply: any) {
    try {
      await request.jwtVerify();
    } catch (err) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Valid authorization token required.' },
        timestamp: new Date().toISOString(),
      });
    }

    const payload = request.user;
    const userId = payload?.sub || payload?.user_id;
    const tenantId = payload?.tenant_id;

    // Load the live user by email/id and tenant_id. If missing, 401.
    let dbUser: User | null = null;
    if (payload?.email && tenantId) {
      dbUser = await store.getUserByEmail(tenantId, payload.email);
    }
    if (!dbUser && userId) {
      dbUser = await store.getUserById(tenantId, userId);
    }
    if (!dbUser && payload?.email) {
      const globalUsers = await store.getUserByEmailGlobal(payload.email);
      dbUser = globalUsers.find(u => u.role === 'super_admin') || null;
    }
    if (!dbUser) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'User account no longer exists.' },
        timestamp: new Date().toISOString(),
      });
    }

    // Account active status revocation check (rejects archived, suspended, or inactive accounts)
    if (dbUser.status !== 'active') {
      const errorCode = dbUser.status === 'archived' ? 'ACCOUNT_ARCHIVED' : 'ACCOUNT_NOT_ACTIVE';
      return reply.status(403).send({
        success: false,
        error: {
          code: errorCode,
          message: `Your account access has been revoked (status: ${dbUser.status}). Please contact academy administration.`,
        },
        timestamp: new Date().toISOString(),
      });
    }

    // Portal blocked restriction
    const portalBlocked = Boolean((dbUser.metadata as any)?.portal_blocked);
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

    const isMustChange = Boolean(
      payload.must_change_password ||
      (dbUser?.metadata as any)?.must_change_password ||
      (dbUser?.metadata as any)?.requires_password_change
    );
    if (isMustChange) {
      const reqPath = (request.url || '').split('?')[0];
      const allowedPaths = [
        '/api/v1/auth/change-password',
        '/api/v1/auth/session',
        '/api/v1/auth/me',
        '/api/v1/auth/logout',
      ];
      if (!allowedPaths.includes(reqPath)) {
        return reply.status(403).send({
          success: false,
          error: {
            code: 'MUST_CHANGE_PASSWORD',
            message: 'You must change your default password before accessing the system.',
          },
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Role-segregated academy suspension check
    if (tenantId && dbUser.role !== 'super_admin') {
      const tenant = await store.getTenantById(tenantId);
      if (tenant && tenant.status === 'suspended') {
        const url = request.url || '';
        const isAllowedBillingPath =
          url.includes('/saas/trial-status') ||
          url.includes('/saas/receipts') ||
          url.includes('/saas/banking-config') ||
          url.includes('/saas/my-academy') ||
          url.includes('/auth/me') ||
          url.includes('/tenant/active-popup');

        if (dbUser.role === 'tenant_admin' && isAllowedBillingPath) {
          // Allow tenant_admin/director restricted access to billing settlement desk
        } else {
          return reply.status(403).send({
            success: false,
            error: {
              code: 'ACADEMY_SUSPENDED',
              message: 'This academy has been suspended by the platform administrator. Please contact billing support.',
              tenant_name: tenant.name,
              suspended_reason: tenant.suspended_reason || 'Administrative hold'
            },
            timestamp: new Date().toISOString(),
          });
        }
      }
    }

    // Put live role, live access map, teaching_assignments, and portal_blocked on request.user
    const liveRole = dbUser.role;
    const liveAccess = resolveUserAccess(dbUser);
    const teachingAssignments = Array.isArray(dbUser.metadata?.teaching_assignments)
      ? dbUser.metadata.teaching_assignments
      : [];

    request.user = {
      ...payload,
      id: dbUser.id,
      sub: dbUser.id,
      user_id: dbUser.id,
      email: dbUser.email,
      role: liveRole,
      access: liveAccess,
      teaching_assignments: teachingAssignments,
      portal_blocked: portalBlocked,
      status: dbUser.status,
    };
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
  await fastify.register(authRoutes(store, mailer), { prefix: '/api/v1/auth' });

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

