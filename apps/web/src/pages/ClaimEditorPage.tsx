import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { client } from '../api/client.js'
import { formatCents, parseDollarsToCents } from '../money.js'

interface ItemDraft {
  description: string
  amount: string // dollars as typed, e.g. "12.34"
}

export function ClaimEditorPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [items, setItems] = useState<ItemDraft[]>([{ description: '', amount: '' }])
  const [status, setStatus] = useState<string>('draft')
  const [decisionReason, setDecisionReason] = useState<string | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!id) return
    void client.GET('/claims/{id}', { params: { path: { id } } }).then((r) => {
      if (!r.data) return
      setTitle(r.data.title)
      setStatus(r.data.status)
      setDecisionReason(r.data.decisionReason)
      setItems(
        r.data.items.map((i) => ({
          description: i.description,
          amount: (i.amountCents / 100).toFixed(2),
        })),
      )
    })
  }, [id])

  const editable = status === 'draft'

  const parsed = items.map((i) => ({
    description: i.description,
    amountCents: parseDollarsToCents(i.amount),
  }))
  const totalCents = parsed.reduce((sum, i) => sum + (i.amountCents ?? 0), 0)

  function setItem(index: number, patch: Partial<ItemDraft>) {
    setItems(items.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    setErrors([])
    setSaved(false)
    const bad = parsed.filter((i) => i.amountCents === null)
    if (bad.length > 0) {
      setErrors(['Amounts must look like 12.34'])
      return
    }
    const body = {
      title,
      items: parsed.map((i) => ({ description: i.description, amountCents: i.amountCents! })),
    }
    const result = id
      ? await client.PATCH('/claims/{id}', { params: { path: { id } }, body })
      : await client.POST('/claims', { body })
    if (result.error) {
      const details = (result.error as { errors?: { field: string; message: string }[] }).errors
      setErrors(details ? details.map((e) => `${e.field}: ${e.message}`) : ['Save failed'])
      return
    }
    if (!id && result.data) {
      navigate(`/claims/${result.data.id}`)
      return
    }
    setSaved(true)
  }

  async function submitClaim() {
    if (!id) return
    setErrors([])
    const result = await client.POST('/claims/{id}/submit', { params: { path: { id } } })
    if (result.error) {
      setErrors(['Submit failed — is the claim still a draft?'])
      return
    }
    navigate('/claims')
  }

  return (
    <>
      <h1>{id ? 'Claim' : 'New claim'}</h1>
      <p>
        Status:{' '}
        <strong className="status" data-testid="claim-status">
          {status}
        </strong>
        {decisionReason && (
          <>
            {' — '}
            <span data-testid="decision-reason">{decisionReason}</span>
          </>
        )}
      </p>
      <form onSubmit={save} aria-label="claim editor">
        <label>
          Title
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={!editable}
          />
        </label>

        {items.map((item, index) => (
          <div className="item-row" key={index}>
            <label>
              Description
              <input
                value={item.description}
                onChange={(e) => setItem(index, { description: e.target.value })}
                disabled={!editable}
              />
            </label>
            <label>
              Amount ($)
              <input
                value={item.amount}
                onChange={(e) => setItem(index, { amount: e.target.value })}
                disabled={!editable}
                inputMode="decimal"
              />
            </label>
            {editable && items.length > 1 && (
              <button type="button" onClick={() => setItems(items.filter((_, i) => i !== index))}>
                Remove
              </button>
            )}
          </div>
        ))}

        {editable && (
          <button
            type="button"
            onClick={() => setItems([...items, { description: '', amount: '' }])}
          >
            Add item
          </button>
        )}

        <p data-testid="total">Total: {formatCents(totalCents)}</p>

        {saved && (
          <p role="status" data-testid="save-confirmation">
            Draft saved
          </p>
        )}

        {errors.length > 0 && (
          <ul role="alert">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        )}

        {editable && (
          <div className="actions">
            <button type="submit" className="primary">
              Save draft
            </button>
            {id && (
              <button type="button" onClick={submitClaim}>
                Submit for approval
              </button>
            )}
          </div>
        )}
      </form>
    </>
  )
}
