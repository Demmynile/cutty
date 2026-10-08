import { defineField, defineType } from 'sanity'

// Dashboard staff accounts. Create/reset/deactivate with
// apps/admin/scripts/create-admin.mjs — credentials are never edited here.
export const adminUser = defineType({
  name: 'adminUser',
  title: 'Admin User',
  type: 'document',
  fields: [
    defineField({ name: 'email', title: 'Email', type: 'string', readOnly: true }),
    defineField({ name: 'name', title: 'Name', type: 'string', readOnly: true }),
    defineField({ name: 'role', title: 'Role', type: 'string', options: { list: ['owner', 'staff'] }, readOnly: true }),
    defineField({ name: 'isActive', title: 'Active', type: 'boolean', readOnly: true }),
    defineField({ name: 'lastLoginAt', title: 'Last Login', type: 'datetime', readOnly: true }),
    defineField({ name: 'createdAt', title: 'Created', type: 'datetime', readOnly: true }),
    defineField({ name: 'passwordHash', type: 'string', hidden: true, readOnly: true }),
    defineField({ name: 'totpSecret', type: 'string', hidden: true, readOnly: true }),
    defineField({ name: 'sessionVersion', type: 'number', hidden: true, readOnly: true }),
  ],
  preview: { select: { title: 'name', subtitle: 'email' } },
})
