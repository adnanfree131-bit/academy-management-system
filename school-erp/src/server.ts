import Fastify from 'fastify'
import cors from '@fastify/cors'
import { getDb, migrate } from './db/db.js'
import { registerRoutes } from './api/routes.js'
import { registerMetaRoutes } from './api/me.js'

export async function buildServer() {
  const app = Fastify({ logger: true })
  try {
    await app.register(cors, { origin: true })
  } catch {
    // cors plugin unavailable offline — same-origin dev server is fine
  }
  await registerRoutes(app)
  await registerMetaRoutes(app)
  return app
}

export async function startServer(port = Number(process.env.PORT ?? 4600)) {
  const db = await getDb()
  await migrate(db)
  const app = await buildServer()
  await app.listen({ port, host: '0.0.0.0' })
  return app
}

// start when run directly (tsx watch src/server.ts)
if (process.argv[1] && process.argv[1].endsWith('server.ts')) {
  startServer().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
