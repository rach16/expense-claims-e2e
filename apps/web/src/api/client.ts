import createClient from 'openapi-fetch'
import type { paths } from './schema.js'
import { clearSession, getToken, setToken } from '../auth.js'
import { isBugEnabled } from '../bugs.js'

export const client = createClient<paths>({ baseUrl: '/api' })

/**
 * Access tokens live 5 minutes. When one expires mid-session the fix is not to
 * make the user log in again — it is to spend the refresh cookie we already
 * hold, then replay the original request.
 *
 * The body has to be captured on the way OUT: by the time a 401 comes back the
 * request stream is consumed and cannot be cloned.
 */
const bodies = new WeakMap<Request, string>()

let inFlightRefresh: Promise<boolean> | null = null

async function refreshAccessToken(): Promise<boolean> {
  // one refresh shared by concurrent 401s, so a burst can't rotate the token
  // family several times over
  inFlightRefresh ??= (async () => {
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      })
      if (!response.ok) return false
      const { accessToken } = (await response.json()) as { accessToken: string }
      setToken(accessToken)
      return true
    } catch {
      return false
    }
  })()

  const ok = await inFlightRefresh
  inFlightRefresh = null
  return ok
}

function redirectToLogin(): void {
  clearSession()
  const here = `${window.location.pathname}${window.location.search}`
  window.location.assign(`/login?next=${encodeURIComponent(here)}`)
}

client.use({
  async onRequest({ request }) {
    const token = getToken()
    if (token) request.headers.set('authorization', `Bearer ${token}`)
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      bodies.set(request, await request.clone().text())
    }
    return request
  },

  async onResponse({ request, response }) {
    // BUG NO_TOKEN_REFRESH: never spends the refresh cookie, so every session
    // dies after the 5-minute access-token TTL with an unhelpful error
    if (response.status !== 401 || isBugEnabled('NO_TOKEN_REFRESH')) return response
    // never recurse through the auth endpoints themselves
    if (new URL(request.url).pathname.startsWith('/api/auth/')) return response

    if (!(await refreshAccessToken())) {
      redirectToLogin()
      return response
    }

    const body = bodies.get(request)
    const headers = new Headers(request.headers)
    headers.set('authorization', `Bearer ${getToken()}`)

    const retried = await fetch(request.url, {
      method: request.method,
      headers,
      credentials: 'include',
      ...(body ? { body } : {}),
    })
    if (retried.status === 401) redirectToLogin()
    return retried
  },
})
