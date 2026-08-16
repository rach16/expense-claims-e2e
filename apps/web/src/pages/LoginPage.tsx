import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { client } from '../api/client.js'
import { saveSession, type Role } from '../auth.js'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    const login = await client.POST('/auth/login', { body: { email, password } })
    if (!login.data) {
      setError('Invalid email or password')
      return
    }
    localStorage.setItem('accessToken', login.data.accessToken)
    const me = await client.GET('/me')
    if (!me.data) {
      setError('Could not load your profile')
      return
    }
    saveSession(login.data.accessToken, me.data.role as Role, me.data.email)
    navigate('/claims')
  }

  return (
    <>
      <h1>Sign in</h1>
      <form onSubmit={onSubmit} aria-label="sign in">
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <button type="submit" className="primary">
          Sign in
        </button>
      </form>
    </>
  )
}
