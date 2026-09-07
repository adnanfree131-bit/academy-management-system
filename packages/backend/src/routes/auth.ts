import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import { AuthService } from '../services/auth.js';
import { IDataStore } from '../services/store.js';
import { IMailerService } from '../services/mailer.js';
import { JWTPayload, AuthSessionResponse } from '@apex/shared-types';

export function authRoutes(
  store: IDataStore,
  mailer: IMailerService
) {
  const authService = new AuthService(store, mailer);

  return async function (fastify: FastifyInstance, _opts: FastifyPluginOptions) {
    // 1. Request 6-digit OTP
    fastify.post('/request-otp', async (request, reply) => {
      const schema = z.object({
        email: z.string().email(),
        tenant_slug: z.string().min(1).default('apex'),
      });

      const parseResult = schema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'A valid email and academy tenant slug are required.',
            details: parseResult.error.flatten(),
          },
          timestamp: new Date().toISOString(),
        });
      }

      try {
        const { email, tenant_slug } = parseResult.data;
        const result = await authService.requestOTP(email, tenant_slug);
        return reply.send({
          success: true,
          data: result,
          timestamp: new Date().toISOString(),
        });
      } catch (err: any) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'AUTH_REQUEST_FAILED',
            message: err.message || 'Failed to dispatch verification code.',
          },
          timestamp: new Date().toISOString(),
        });
      }
    });

    // 2. Verify OTP & Issue Session JWT
    fastify.post('/verify-otp', async (request, reply) => {
      const schema = z.object({
        email: z.string().email(),
        otp: z.string().length(6, 'Verification code must be 6 digits'),
        tenant_slug: z.string().min(1).default('apex'),
      });

      const parseResult = schema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Valid 6-digit code and email are required.',
            details: parseResult.error.flatten(),
          },
          timestamp: new Date().toISOString(),
        });
      }

      try {
        const { email, otp, tenant_slug } = parseResult.data;
        const { user, tenant } = await authService.verifyOTP(email, otp, tenant_slug);

        const jwtPayload: JWTPayload = {
          sub: user.id,
          tenant_id: tenant.id,
          email: user.email,
          role: user.role,
        };

        const token = fastify.jwt.sign(jwtPayload, { expiresIn: '7d' });

        const sessionResponse: AuthSessionResponse = {
          token,
          expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
          user: {
            id: user.id,
            tenant_id: user.tenant_id,
            email: user.email,
            full_name: user.full_name,
            role: user.role,
            avatar_url: user.avatar_url,
          },
          tenant: {
            id: tenant.id,
            name: tenant.name,
            slug: tenant.slug,
            status: tenant.status,
            academic_session: tenant.settings.academic_session,
            campus_name: tenant.settings.campus_name,
          },
        };

        return reply.send({
          success: true,
          data: sessionResponse,
          timestamp: new Date().toISOString(),
        });
      } catch (err: any) {
        return reply.status(401).send({
          success: false,
          error: {
            code: 'AUTH_VERIFICATION_FAILED',
            message: err.message || 'Invalid or expired verification code.',
          },
          timestamp: new Date().toISOString(),
        });
      }
    });

    // 3. Me endpoint (Returns authenticated user profile & tenant context)
    fastify.get('/me', {
      onRequest: [(fastify as any).authenticate],
    }, async (request: any, reply) => {
      const jwtUser = request.user as JWTPayload;
      const user = await store.getUserByEmail(jwtUser.tenant_id, jwtUser.email);
      const tenant = await store.getTenantById(jwtUser.tenant_id);

      if (!user || !tenant) {
        return reply.status(401).send({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User or tenant record no longer exists.' },
          timestamp: new Date().toISOString(),
        });
      }

      return reply.send({
        success: true,
        data: {
          user,
          tenant,
        },
        timestamp: new Date().toISOString(),
      });
    });
  };
}
