import { z } from 'zod'

// Emails are trimmed and lower-cased before validation, so "Asha@Example.com "
// and "asha@example.com" are the same account.
const email = z
  .string({ error: 'Email is required' })
  .trim()
  .toLowerCase()
  .max(254, 'Email is too long')
  .pipe(z.email('Enter a valid email address'))

// Unknown fields (e.g. a "role" sent by a client) are silently dropped by zod.
export const registerSchema = z.object({
  name: z
    .string({ error: 'Name is required' })
    .trim()
    .min(1, 'Name is required')
    .max(100, 'Name must be at most 100 characters'),
  email,
  password: z
    .string({ error: 'Password is required' })
    .min(8, 'Password must be at least 8 characters')
    // bcrypt only uses the first 72 bytes of a password.
    .max(72, 'Password must be at most 72 characters'),
})

export const loginSchema = z.object({
  email,
  password: z
    .string({ error: 'Password is required' })
    .min(1, 'Password is required'),
  // true on /login?mode=admin → the server rejects non-admin accounts.
  asAdmin: z.boolean().optional().default(false),
})
