export type Role = 'submitter' | 'approver' | 'admin'

// NOTE: access token in localStorage is a deliberate test-app trade-off — it
// makes Playwright storageState reuse trivial. The refresh token stays in an
// httpOnly cookie either way. ADR-worthy: in a production app the access token
// would live in memory only.
export function saveSession(token: string, role: Role, email: string): void {
  localStorage.setItem('accessToken', token)
  localStorage.setItem('role', role)
  localStorage.setItem('email', email)
}

export function getToken(): string | null {
  return localStorage.getItem('accessToken')
}

export function getRole(): Role | null {
  return localStorage.getItem('role') as Role | null
}

export function clearSession(): void {
  localStorage.removeItem('accessToken')
  localStorage.removeItem('role')
  localStorage.removeItem('email')
}
