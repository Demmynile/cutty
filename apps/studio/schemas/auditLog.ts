import { defineField, defineType } from 'sanity'

// Append-only security trail written by the admin server (lib/server/audit.ts).
// Every field is read-only in Studio; restrict delete rights on this type to
// the project owner role in Sanity's access settings.
export const auditLog = defineType({
  name: 'auditLog',
  title: 'Audit Log',
  type: 'document',
  readOnly: true,
  fields: [
    defineField({ name: 'action', title: 'Action', type: 'string' }),
    defineField({ name: 'outcome', title: 'Outcome', type: 'string' }),
    defineField({ name: 'actorType', title: 'Actor Type', type: 'string' }),
    defineField({ name: 'actorId', title: 'Actor ID', type: 'string' }),
    defineField({ name: 'actorEmail', title: 'Actor Email', type: 'string' }),
    defineField({ name: 'targetType', title: 'Target Type', type: 'string' }),
    defineField({ name: 'targetId', title: 'Target ID', type: 'string' }),
    defineField({ name: 'ip', title: 'IP Address', type: 'string' }),
    defineField({ name: 'details', title: 'Details (JSON)', type: 'text' }),
    defineField({ name: 'createdAt', title: 'Time', type: 'datetime' }),
  ],
  orderings: [{ title: 'Newest', name: 'newest', by: [{ field: 'createdAt', direction: 'desc' }] }],
  preview: { select: { title: 'action', subtitle: 'createdAt', description: 'actorEmail' } },
})
