import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import sensible from '@fastify/sensible';
import { IDataStore, InMemoryDataStore } from './services/store.js';
import { IMailerService, createMailerService } from './services/mailer.js';
import { authRoutes } from './routes/auth.js';
import { academicRoutes } from './routes/academic.js';
import { sisRoutes } from './routes/sis.js';

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
      system: 'Apex Academy Management ERP Backend',
      timestamp: new Date().toISOString(),
    };
  });

  // Auth Routes
  await fastify.register(authRoutes(store, mailer), { prefix: '/api/v1/auth' });

  // Academic & SIS Routes
  await fastify.register(academicRoutes(store), { prefix: '/api/v1/academic' });
  await fastify.register(sisRoutes(store), { prefix: '/api/v1/sis' });

  return fastify;
}

