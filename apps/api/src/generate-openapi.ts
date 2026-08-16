import { mkdir, writeFile } from 'node:fs/promises'
import { buildApp } from './app.js'

const app = await buildApp()
await app.ready()

const spec = app.swagger()
await mkdir('openapi', { recursive: true })
await writeFile('openapi/openapi.json', `${JSON.stringify(spec, null, 2)}\n`)
await app.close()

console.log('openapi/openapi.json written')
