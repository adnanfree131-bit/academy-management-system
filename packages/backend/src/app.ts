import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import sensible from '@fastify/sensible';
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
  const mailer = options.mailer || createMailerService();
  const jwtSecret = options.jwtSecret || process.env.JWT_SECRET || 'super-secret-default-dev-key-minimum-32-chars';

  const fastify = Fastify({
    logger: process.env.NODE_ENV === 'test' ? false : (process.env.NODE_ENV === 'production' ? true : true),
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
      reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Valid authorization token required.' },
        timestamp: new Date().toISOString(),
      });
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

