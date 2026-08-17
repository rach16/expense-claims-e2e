import { Type } from '@sinclair/typebox'
import { and, count, desc, eq, inArray } from 'drizzle-orm'
import type { AppInstance } from '../types.js'
import { isBugEnabled } from '../bugs.js'
import { requireAuth, requireRole } from '../auth/guard.js'
import { canTransition } from '../domain/claim-status.js'
import type { ClaimStatus } from '../domain/claim-status.js'
import { sumCents } from '../domain/money.js'
import { validateClaimDraft } from '../domain/validate-claim.js'
import { claimItems, claims } from '../db/schema.js'

const ClaimItemBody = Type.Object({
  description: Type.String({ maxLength: 200 }),
  amountCents: Type.Integer(),
})

const ClaimBody = Type.Object({
  title: Type.String({ maxLength: 200 }),
  items: Type.Array(ClaimItemBody, { maxItems: 50 }),
})

const ClaimResponse = Type.Object({
  id: Type.String(),
  title: Type.String(),
  status: Type.String(),
  totalCents: Type.Integer(),
  decisionReason: Type.Union([Type.String(), Type.Null()]),
  items: Type.Array(
    Type.Object({
      id: Type.String(),
      description: Type.String(),
      amountCents: Type.Integer(),
    }),
  ),
})

const ClaimSummary = Type.Object({
  id: Type.String(),
  title: Type.String(),
  status: Type.String(),
  totalCents: Type.Integer(),
})

const ValidationErrors = Type.Object({
  errors: Type.Array(Type.Object({ field: Type.String(), message: Type.String() })),
})

const NotFound = Type.Object({ error: Type.String() })
const Conflict = Type.Object({ error: Type.String() })

type ClaimRow = typeof claims.$inferSelect

async function serializeClaim(app: AppInstance, claim: ClaimRow) {
  const items = await app.db.select().from(claimItems).where(eq(claimItems.claimId, claim.id))
  return {
    id: claim.id,
    title: claim.title,
    status: claim.status,
    totalCents: sumCents(items.map((i) => i.amountCents)),
    decisionReason: claim.decisionReason,
    items: items.map((i) => ({ id: i.id, description: i.description, amountCents: i.amountCents })),
  }
}

/** tenant-scoped fetch; returns undefined when invisible to the caller */
async function visibleClaim(
  app: AppInstance,
  claimId: string,
  user: { sub: string; tenantId: string; role: string },
): Promise<ClaimRow | undefined> {
  const [claim] = await app.db.select().from(claims).where(eq(claims.id, claimId))
  if (!claim) return undefined
  // BUG IDOR_CLAIM_READ: skips tenant + ownership scoping, exposing any claim by id
  if (isBugEnabled('IDOR_CLAIM_READ')) return claim
  if (claim.tenantId !== user.tenantId) return undefined
  if (user.role === 'submitter' && claim.ownerId !== user.sub) return undefined
  return claim
}

export function claimRoutes(app: AppInstance): void {
  app.post(
    '/claims',
    {
      preHandler: [requireAuth],
      schema: {
        body: ClaimBody,
        response: { 201: ClaimResponse, 400: ValidationErrors },
      },
    },
    async (request, reply) => {
      const errors = validateClaimDraft(request.body)
      if (errors.length > 0) return reply.code(400).send({ errors })

      const [claim] = await app.db
        .insert(claims)
        .values({
          tenantId: request.user.tenantId,
          ownerId: request.user.sub,
          title: request.body.title,
          status: 'draft',
        })
        .returning()

      await app.db
        .insert(claimItems)
        .values(request.body.items.map((item) => ({ ...item, claimId: claim!.id })))

      return reply.code(201).send(await serializeClaim(app, claim!))
    },
  )

  app.get(
    '/claims',
    {
      preHandler: [requireAuth],
      schema: {
        querystring: Type.Object({
          status: Type.Optional(
            Type.Union([
              Type.Literal('draft'),
              Type.Literal('submitted'),
              Type.Literal('approved'),
              Type.Literal('rejected'),
            ]),
          ),
          page: Type.Integer({ minimum: 1, default: 1 }),
          pageSize: Type.Integer({ minimum: 1, maximum: 100, default: 20 }),
        }),
        response: {
          200: Type.Object({
            items: Type.Array(ClaimSummary),
            total: Type.Integer(),
            page: Type.Integer(),
            pageSize: Type.Integer(),
          }),
        },
      },
    },
    async (request) => {
      const { status, page, pageSize } = request.query
      const conditions = [eq(claims.tenantId, request.user.tenantId)]
      if (request.user.role === 'submitter') conditions.push(eq(claims.ownerId, request.user.sub))
      if (status) conditions.push(eq(claims.status, status))
      const where = and(...conditions)

      const [{ total }] = (await app.db
        .select({ total: count() })
        .from(claims)
        .where(where)) as [{ total: number }]

      const rows = await app.db
        .select()
        .from(claims)
        .where(where)
        .orderBy(desc(claims.createdAt), desc(claims.id))
        .limit(pageSize)
        // BUG PAGINATION_OFF_BY_ONE: offsets by page, skipping/duplicating a row
        .offset(isBugEnabled('PAGINATION_OFF_BY_ONE') ? page * pageSize - pageSize + 1 : (page - 1) * pageSize)

      const rowIds = rows.map((r) => r.id)
      const items = rowIds.length
        ? await app.db.select().from(claimItems).where(inArray(claimItems.claimId, rowIds))
        : []
      const totals = new Map<string, number[]>()
      for (const item of items) {
        const list = totals.get(item.claimId) ?? []
        list.push(item.amountCents)
        totals.set(item.claimId, list)
      }

      return {
        items: rows.map((r) => ({
          id: r.id,
          title: r.title,
          status: r.status,
          totalCents: sumCents(totals.get(r.id) ?? []),
        })),
        total,
        page,
        pageSize,
      }
    },
  )

  app.get(
    '/claims/:id',
    {
      preHandler: [requireAuth],
      schema: {
        params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
        response: { 200: ClaimResponse, 404: NotFound },
      },
    },
    async (request, reply) => {
      const claim = await visibleClaim(app, request.params.id, request.user)
      if (!claim) return reply.code(404).send({ error: 'claim not found' })
      return serializeClaim(app, claim)
    },
  )

  app.patch(
    '/claims/:id',
    {
      preHandler: [requireAuth],
      schema: {
        params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
        body: ClaimBody,
        response: { 200: ClaimResponse, 400: ValidationErrors, 404: NotFound, 409: Conflict },
      },
    },
    async (request, reply) => {
      const claim = await visibleClaim(app, request.params.id, request.user)
      if (!claim || claim.ownerId !== request.user.sub) {
        return reply.code(404).send({ error: 'claim not found' })
      }
      if (claim.status !== 'draft') {
        return reply.code(409).send({ error: 'only draft claims can be edited' })
      }
      const errors = validateClaimDraft(request.body)
      if (errors.length > 0) return reply.code(400).send({ errors })

      const [updated] = await app.db
        .update(claims)
        .set({ title: request.body.title, updatedAt: new Date() })
        .where(and(eq(claims.id, claim.id), eq(claims.status, 'draft')))
        .returning()
      if (!updated) return reply.code(409).send({ error: 'claim is no longer editable' })

      await app.db.delete(claimItems).where(eq(claimItems.claimId, claim.id))
      await app.db
        .insert(claimItems)
        .values(request.body.items.map((item) => ({ ...item, claimId: claim.id })))

      return serializeClaim(app, updated)
    },
  )

  app.post(
    '/claims/:id/submit',
    {
      preHandler: [requireAuth],
      schema: {
        params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
        response: { 200: ClaimResponse, 404: NotFound, 409: Conflict },
      },
    },
    async (request, reply) => {
      const claim = await visibleClaim(app, request.params.id, request.user)
      if (!claim || claim.ownerId !== request.user.sub) {
        return reply.code(404).send({ error: 'claim not found' })
      }
      if (!canTransition(claim.status as ClaimStatus, 'submitted')) {
        return reply.code(409).send({ error: `cannot submit a ${claim.status} claim` })
      }
      // atomic conditional update: the WHERE re-checks status so a concurrent
      // transition cannot be overwritten
      const [updated] = await app.db
        .update(claims)
        .set({ status: 'submitted', updatedAt: new Date() })
        .where(and(eq(claims.id, claim.id), eq(claims.status, claim.status)))
        .returning()
      if (!updated) return reply.code(409).send({ error: 'claim state changed concurrently' })
      return serializeClaim(app, updated)
    },
  )

  app.post(
    '/claims/:id/decision',
    {
      preHandler: [requireAuth, requireRole('approver', 'admin')],
      schema: {
        params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
        body: Type.Object({
          decision: Type.Union([Type.Literal('approved'), Type.Literal('rejected')]),
          reason: Type.Optional(Type.String({ maxLength: 500 })),
        }),
        response: { 200: ClaimResponse, 404: NotFound, 409: Conflict },
      },
    },
    async (request, reply) => {
      const claim = await visibleClaim(app, request.params.id, request.user)
      if (!claim) return reply.code(404).send({ error: 'claim not found' })

      const { decision, reason } = request.body
      if (!canTransition(claim.status as ClaimStatus, decision)) {
        return reply.code(409).send({ error: `cannot ${decision} a ${claim.status} claim` })
      }
      // race-safe: only one concurrent decision can win the conditional update.
      // BUG RACE_DOUBLE_APPROVE: drops the status predicate, so simultaneous
      // decisions both succeed and the last writer silently wins
      const guard = isBugEnabled('RACE_DOUBLE_APPROVE')
        ? eq(claims.id, claim.id)
        : and(eq(claims.id, claim.id), eq(claims.status, 'submitted'))
      const [updated] = await app.db
        .update(claims)
        .set({
          status: decision,
          decisionReason: reason ?? null,
          decidedBy: request.user.sub,
          updatedAt: new Date(),
        })
        .where(guard)
        .returning()
      if (!updated) return reply.code(409).send({ error: 'claim was already decided' })
      return serializeClaim(app, updated)
    },
  )
}
