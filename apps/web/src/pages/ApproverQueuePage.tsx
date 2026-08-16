import { useCallback, useEffect, useState } from 'react'
import { client } from '../api/client.js'
import { formatCents } from '../money.js'

interface Row {
  id: string
  title: string
  totalCents: number
}

export function ApproverQueuePage() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [reason, setReason] = useState('')

  const load = useCallback(() => {
    void client
      .GET('/claims', { params: { query: { status: 'submitted', page: 1, pageSize: 50 } } })
      .then((r) => setRows(r.data?.items ?? []))
  }, [])

  useEffect(load, [load])

  async function decide(id: string, decision: 'approved' | 'rejected', why?: string) {
    await client.POST('/claims/{id}/decision', {
      params: { path: { id } },
      body: { decision, ...(why ? { reason: why } : {}) },
    })
    setRejecting(null)
    setReason('')
    load()
  }

  if (rows === null) return <p>Loading…</p>

  return (
    <>
      <h1>Approval queue</h1>
      {rows.length === 0 ? (
        <p>Nothing waiting for approval.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Total</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.title}</td>
                <td>{formatCents(row.totalCents)}</td>
                <td>
                  {rejecting === row.id ? (
                    <span className="actions">
                      <label>
                        Reason
                        <input value={reason} onChange={(e) => setReason(e.target.value)} />
                      </label>
                      <button type="button" onClick={() => decide(row.id, 'rejected', reason)}>
                        Confirm rejection
                      </button>
                    </span>
                  ) : (
                    <span className="actions">
                      <button type="button" onClick={() => decide(row.id, 'approved')}>
                        Approve
                      </button>
                      <button type="button" onClick={() => setRejecting(row.id)}>
                        Reject
                      </button>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}
