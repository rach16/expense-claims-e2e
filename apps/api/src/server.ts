import { buildApp } from './app.js'

const port = Number(process.env.PORT ?? 3000)

const app = await buildApp({
  databaseUrl:
    process.env.DATABASE_URL ?? 'postgres://claims:claims_local_dev@localhost:5432/claims',
  jwtSecret: process.env.JWT_SECRET ?? 'local-dev-secret-do-not-use-in-prod',
})

await app.listen({ port, host: '0.0.0.0' })
