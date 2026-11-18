import { z } from 'zod'

// GET /users?search=asha&role=user&page=2&pageSize=10
export const listUsersQuery = z.object({
  // Matches name or email. Blank → no filter.
  search: z
    .string()
    .trim()
    .max(100, 'Search must be at most 100 characters')
    .optional()
    .transform((value) => value || undefined),
  role: z
    .enum(['admin', 'user'], { error: 'Role must be admin or user' })
    .optional(),
  page: z.coerce
    .number({ error: 'Page must be a number' })
    .int('Page must be a whole number')
    .min(1, 'Page must be 1 or more')
    .optional()
    .default(1),
  // Users page: 10. The user picker asks for 5 (10 while searching).
  pageSize: z.coerce
    .number({ error: 'Page size must be a number' })
    .int('Page size must be a whole number')
    .min(1, 'Page size must be between 1 and 50')
    .max(50, 'Page size must be between 1 and 50')
    .optional()
    .default(10),
})

// GET /users/:id
export const userIdParams = z.object({
  id: z.coerce
    .number({ error: 'User id must be a number' })
    .int('User id must be a number')
    .positive('User id must be a number'),
})
