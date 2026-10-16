import { describe, expect, it, vi } from 'vitest'
import { schemaTypes } from '../schemas'

type Item = { kind: 'item'; title: string; type?: string } | { kind: 'divider' }

// Minimal StructureBuilder that records the desk structure it is asked to build.
function builder() {
  const S = {
    list: () => {
      const list = { title: '', items: [] as Item[] }
      const api = {
        title: (t: string) => { list.title = t; return api },
        items: (items: Item[]) => { list.items = items; return list },
      }
      return api
    },
    listItem: () => {
      const item: Item = { kind: 'item', title: '' }
      const api = {
        title: (t: string) => { (item as { title: string }).title = t; return api },
        child: (c: { type: string }) => { (item as { type?: string }).type = c.type; return item },
      }
      return api
    },
    documentTypeList: (type: string) => ({ type }),
    divider: (): Item => ({ kind: 'divider' }),
  }
  return S
}

describe('sanity.config', () => {
  it('reads the project from env and registers the schemas and tools', async () => {
    vi.stubEnv('SANITY_STUDIO_PROJECT_ID', 'proj123')
    vi.resetModules()
    const { default: config } = await import('../sanity.config')
    expect(config).toMatchObject({ name: 'cutty-studio', projectId: 'proj123', dataset: 'production' })
    expect(config.schema.types.map((t: { name: string }) => t.name)).toEqual(schemaTypes.map((t) => t.name))
    expect(config.plugins.map((p: { name: string }) => p.name)).toEqual(['structure', 'vision'])
  })

  it('honours SANITY_STUDIO_DATASET', async () => {
    vi.stubEnv('SANITY_STUDIO_DATASET', 'staging')
    vi.resetModules()
    const { default: config } = await import('../sanity.config')
    expect(config.dataset).toBe('staging')
  })

  it('lists every editable document type in the desk', async () => {
    const { default: config } = await import('../sanity.config')
    const structure = (config.plugins[0] as unknown as { options: { structure: (S: unknown) => { title: string; items: Item[] } } }).options.structure(builder())
    expect(structure.title).toBe('Cutty Admin')
    const types = structure.items.flatMap((i) => (i.kind === 'item' ? [i.type] : []))
    expect(new Set(types).size).toBe(types.length)
    for (const t of types) expect(schemaTypes.some((s) => s.name === t), t).toBe(true)
    // Internal records are reached through Vision or their parents, not the desk.
    // `barber` is each stylist's booking calendar, synced from their Cutty Pro profile.
    const internal = ['adminUser', 'auditLog', 'barber', 'chatMessage']
    expect(schemaTypes.map((s) => s.name).filter((n) => !types.includes(n)).sort()).toEqual(internal.sort())
  })
})
