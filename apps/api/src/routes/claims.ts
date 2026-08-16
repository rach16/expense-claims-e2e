import { Type } from '@sinclair/typebox'
import { eq } from 'drizzle-orm'
import type { AppInstance } from '../types.js'
import { requireAuth } from '../auth/guard.js'
import { validateClaimDraft } from '../domain/validate-claim.js'
import { sumCents } from '../domain/money.js'
import { claimItems, claims } from '../db/schema.js'

const ClaimItemBody = Type.Object({
  description: Type.String({ maxLength: 200 }),
  amountCents: Type.Integer(),
})

const ClaimResponse = Type.Object({
  id: Type.String(),
  title: Type.String(),
  status: Type.String(),
  totalCents: Type.Integer(),
  items: Type.Array(
    Type.Object({
      id: Type.String(),
      description: Type.String(),
      amountCents: Type.Integer(),
    }),
  ),
})

const ValidationErrors = Type.Object({
  errors: Type.Array(Type.Object({ field: Type.String(), message: Type.String() })),
})

export function claimRoutes(app: AppInstance): void {
  app.post(
    '/claims',
    {
      preHandler: [requireAuth],
      schema: {
        body: Type.Object({
          title: Type.String({ maxLength: 200 }),
          items: Type.Array(ClaimItemBody, { maxItems: 50 }),
        }),
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

      const items = await app.db
        .insert(claimItems)
        .values(request.body.items.map((item) => ({ ...item, claimId: claim!.id })))
        .returning()

      return reply.code(201).send({
        id: claim!.id,
        title: claim!.title,
        status: claim!.status,
        totalCents: sumCents(items.map((i) => i.amountCents)),
        items: items.map((i) => ({
          id: i.id,
          description: i.description,
          amountCents: i.amountCents,
        })),
      })
    },
  )

  app.get(
    '/claims/:id',
    {
      preHandler: [requireAuth],
      schema: {
        params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
        response: {
          200: ClaimResponse,
          404: Type.Object({ error: Type.String() }),
        },
      },
    },
    async (request, reply) => {
      const [claim] = await app.db
        .select()
        .from(claims)
        .where(eq(claims.id, request.params.id))

      // tenant scoping: a claim outside the caller's tenant is a 404, not a 403 —
      // existence must not leak across tenants
      if (!claim || claim.tenantId !== request.user.tenantId) {
        return reply.code(404).send({ error: 'claim not found' })
      }
      // submitters see only their own claims; approvers/admins see the tenant's
      if (request.user.role === 'submitter' && claim.ownerId !== request.user.sub) {
        return reply.code(404).send({ error: 'claim not found' })
      }

      const items = await app.db.select().from(claimItems).where(eq(claimItems.claimId, claim.id))
      return {
        id: claim.id,
        title: claim.title,
        status: claim.status,
        totalCents: sumCents(items.map((i) => i.amountCents)),
        items: items.map((i) => ({
          id: i.id,
          description: i.description,
          amountCents: i.amountCents,
        })),
      }
    },
  )
}
