import { vi } from 'vitest'

// In-memory stand-in for the @sanity/client used by lib/server/sanity.ts.
// Reads are answered by handlers matched against the GROQ text; every write
// (create, patch, transaction) is recorded in `writes` so tests can assert on
// exactly what would have been committed.

export type PatchRecord = {
  id: string
  ifRevisionId?: string
  set: Record<string, unknown>
  unset: string[]
  setIfMissing: Record<string, unknown>
  inc: Record<string, number>
}

export type Write =
  | { type: 'create'; doc: Record<string, unknown> }
  | { type: 'createIfNotExists'; doc: Record<string, unknown> }
  | { type: 'patch'; patch: PatchRecord }
  | { type: 'transaction'; creates: Record<string, unknown>[]; patches: PatchRecord[] }

type Matcher = string | RegExp | ((query: string, params: Record<string, unknown>) => boolean)
type Answer = unknown | ((params: Record<string, unknown>, query: string) => unknown)

function matches(m: Matcher, query: string, params: Record<string, unknown>) {
  if (typeof m === 'string') return query.includes(m)
  if (m instanceof RegExp) return m.test(query)
  return m(query, params)
}

function patchBuilder(id: string, onCommit: (p: PatchRecord) => Promise<unknown>) {
  const record: PatchRecord = { id, set: {}, unset: [], setIfMissing: {}, inc: {} }
  const builder = {
    record,
    ifRevisionId(rev: string) { record.ifRevisionId = rev; return builder },
    set(v: Record<string, unknown>) { Object.assign(record.set, v); return builder },
    unset(keys: string[]) { record.unset.push(...keys); return builder },
    setIfMissing(v: Record<string, unknown>) { Object.assign(record.setIfMissing, v); return builder },
    inc(v: Record<string, number>) { Object.assign(record.inc, v); return builder },
    commit: () => onCommit(record),
  }
  return builder
}

type Builder = ReturnType<typeof patchBuilder>

export function createFakeSanity() {
  const handlers: Array<{ matcher: Matcher; answer: Answer; once: boolean }> = []
  const writes: Write[] = []
  const commitErrors: unknown[] = []

  async function maybeFail() {
    if (commitErrors.length) throw commitErrors.shift()
  }

  const fetch = vi.fn(async (query: string, params: Record<string, unknown> = {}) => {
    const i = handlers.findIndex((h) => matches(h.matcher, query, params))
    if (i === -1) return null
    const h = handlers[i]
    if (h.once) handlers.splice(i, 1)
    return typeof h.answer === 'function' ? (h.answer as (p: unknown, q: string) => unknown)(params, query) : h.answer
  })

  const client = {
    fetch,
    create: vi.fn(async (doc: Record<string, unknown>) => {
      await maybeFail()
      writes.push({ type: 'create', doc })
      return doc
    }),
    createIfNotExists: vi.fn(async (doc: Record<string, unknown>) => {
      await maybeFail()
      writes.push({ type: 'createIfNotExists', doc })
      return doc
    }),
    patch: vi.fn((id: string) =>
      patchBuilder(id, async (record) => {
        await maybeFail()
        writes.push({ type: 'patch', patch: record })
        return {}
      }),
    ),
    transaction: vi.fn(() => {
      const creates: Record<string, unknown>[] = []
      const patches: PatchRecord[] = []
      const tx = {
        create(doc: Record<string, unknown>) { creates.push(doc); return tx },
        createIfNotExists(doc: Record<string, unknown>) { creates.push(doc); return tx },
        patch(id: string, fn: (p: Builder) => Builder) {
          const b = patchBuilder(id, async () => ({}))
          patches.push(fn(b).record)
          return tx
        },
        commit: async () => {
          await maybeFail()
          writes.push({ type: 'transaction', creates, patches })
          return {}
        },
      }
      return tx
    }),
    assets: {
      upload: vi.fn(async () => ({ _id: 'image-abc123abc123abc123abc123-100x100-jpg' })),
    },
  }

  return {
    client,
    writes,
    /** Answers every fetch whose GROQ matches. Later calls don't override earlier ones; use `reset`. */
    on(matcher: Matcher, answer: Answer) {
      handlers.push({ matcher, answer, once: false })
    },
    /** Answers the next matching fetch only (queued in order). */
    once(matcher: Matcher, answer: Answer) {
      handlers.push({ matcher, answer, once: true })
    },
    /** Makes the next commit (patch, create or transaction) reject with `err`. */
    failNextCommit(err: unknown) {
      commitErrors.push(err)
    },
    patches: () => writes.flatMap((w) => (w.type === 'patch' ? [w.patch] : w.type === 'transaction' ? w.patches : [])),
    creates: () => writes.flatMap((w) => (w.type === 'create' || w.type === 'createIfNotExists' ? [w.doc] : w.type === 'transaction' ? w.creates : [])),
    reset() {
      handlers.length = 0
      writes.length = 0
      commitErrors.length = 0
    },
  }
}

export const sanity = createFakeSanity()

/** Drop-in replacement for '@/lib/server/sanity'. */
export const sanityModule = {
  serverClient: sanity.client,
  ref: (id: string) => ({ _type: 'reference' as const, _ref: id }),
  now: () => new Date().toISOString(),
}

export const conflict = () => Object.assign(new Error('Conflict'), { statusCode: 409 })
