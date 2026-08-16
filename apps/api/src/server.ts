import { buildApp } from './app.js'

const port = Number(process.env.PORT ?? 3000)

const app = await buildApp({
  databaseUrl: process.env.DATABASE_URL,
})

await app.listen({ port, host: '0.0.0.0' })
