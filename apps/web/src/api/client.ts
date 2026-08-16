import createClient from 'openapi-fetch'
import type { paths } from './schema.js'
import { getToken } from '../auth.js'

export const client = createClient<paths>({ baseUrl: '/api' })

client.use({
  onRequest({ request }) {
    const token = getToken()
    if (token) request.headers.set('authorization', `Bearer ${token}`)
    return request
  },
})
