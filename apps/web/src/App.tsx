import type { ReactNode } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { clearSession, getRole, getToken } from './auth.js'
import { ApproverQueuePage } from './pages/ApproverQueuePage.js'
import { ClaimEditorPage } from './pages/ClaimEditorPage.js'
import { ClaimsListPage } from './pages/ClaimsListPage.js'
import { LoginPage } from './pages/LoginPage.js'

function RequireAuth({ children }: { children: ReactNode }) {
  if (!getToken()) return <Navigate to="/login" replace />
  return children
}

function Nav() {
  const navigate = useNavigate()
  if (!getToken()) return null
  const role = getRole()
  return (
    <nav aria-label="main">
      <Link to="/claims">My claims</Link>
      {(role === 'approver' || role === 'admin') && <Link to="/queue">Approval queue</Link>}
      <button
        type="button"
        onClick={() => {
          clearSession()
          navigate('/login')
        }}
      >
        Log out
      </button>
    </nav>
  )
}

export function App() {
  return (
    <BrowserRouter>
      <Nav />
      <main>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/claims"
            element={
              <RequireAuth>
                <ClaimsListPage />
              </RequireAuth>
            }
          />
          <Route
            path="/claims/new"
            element={
              <RequireAuth>
                <ClaimEditorPage />
              </RequireAuth>
            }
          />
          <Route
            path="/claims/:id"
            element={
              <RequireAuth>
                <ClaimEditorPage />
              </RequireAuth>
            }
          />
          <Route
            path="/queue"
            element={
              <RequireAuth>
                <ApproverQueuePage />
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/claims" replace />} />
        </Routes>
      </main>
    </BrowserRouter>
  )
}
