import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import sensible from '@fastify/sensible';
import fs from 'fs';
import path from 'path';
import { IDataStore, InMemoryDataStore } from './services/store.js';
import { IMailerService, createMailerService } from './services/mailer.js';
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

    // Role-segregated academy suspension check
    if (request.user && request.user.tenant_id && request.user.role !== 'super_admin') {
      const tenant = await store.getTenantById(request.user.tenant_id);
      if (tenant && tenant.status === 'suspended') {
        const url = request.url || '';
        const isAllowedBillingPath =
          url.includes('/saas/trial-status') ||
          url.includes('/saas/receipts') ||
          url.includes('/saas/banking-config') ||
          url.includes('/saas/my-academy') ||
          url.includes('/auth/me') ||
          url.includes('/tenant/active-popup');

        if (request.user.role === 'tenant_admin' && isAllowedBillingPath) {
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

