import { z } from 'zod'

// GET /users?search=asha&role=user&limit=5
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
  // No limit → everyone (Users page). The user picker asks for 5.
  limit: z.coerce
    .number({ error: 'Limit must be a number' })
    .int('Limit must be a whole number')
    .min(1, 'Limit must be between 1 and 50')
    .max(50, 'Limit must be between 1 and 50')
    .optional(),
})

// GET /users/:id
export const userIdParams = z.object({
  id: z.coerce
    .number({ error: 'User id must be a number' })
    .int('User id must be a number')
    .positive('User id must be a number'),
})
