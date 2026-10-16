import 'server-only'
import { serverClient, now } from './sanity'

export type AuditActor = { type: 'customer' | 'admin' | 'stylist' | 'system'; id: string; email?: string }

export type AuditEvent = {
  action: string
  actor: AuditActor
  target?: { type: string; id: string }
  outcome?: 'success' | 'failure'
  ip?: string
  details?: Record<string, unknown>
}

// Append-only security/audit trail (auth events, money movements, admin
// changes). Never record secrets, passwords, tokens or full card numbers in
// `details`. Failures to write are logged but never break the request.
export async function audit(event: AuditEvent) {
  try {
    await serverClient.create({
      _type: 'auditLog',
      action: event.action,
      actorType: event.actor.type,
      actorId: event.actor.id,
      actorEmail: event.actor.email,
      targetType: event.target?.type,
      targetId: event.target?.id,
      outcome: event.outcome ?? 'success',
      ip: event.ip,
      details: event.details ? JSON.stringify(event.details) : undefined,
      createdAt: now(),
    })
  } catch (err) {
    console.error('[audit] failed to write audit log', event.action, err)
  }
}
