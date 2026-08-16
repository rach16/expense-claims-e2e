import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { client } from '../api/client.js'
import { formatCents } from '../money.js'

interface Row {
  id: string
  title: string
  status: string
  totalCents: number
}

export function ClaimsListPage() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    void client
      .GET('/claims', { params: { query: { page: 1, pageSize: 50 } } })
      .then((r) => setRows(r.data?.items ?? []))
  }, [])

  return (
    <>
      <h1>My claims</h1>
      <p>
        <Link to="/claims/new">
          <button type="button" className="primary">
            New claim
          </button>
        </Link>
      </p>
      {rows === null ? (
        <p>Loading…</p>
      ) : rows.length === 0 ? (
        <p>No claims yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Status</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} onClick={() => navigate(`/claims/${row.id}`)}>
                <td>{row.title}</td>
                <td className="status">{row.status}</td>
                <td>{formatCents(row.totalCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}
