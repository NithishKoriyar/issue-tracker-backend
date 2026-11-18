import { z } from 'zod'

export const ISSUE_STATUSES = ['open', 'in_progress', 'closed']

const status = z.enum(ISSUE_STATUSES, {
  error: 'Status must be open, in_progress or closed',
})

const title = z
  .string({ error: 'Title is required' })
  .trim()
  .min(1, 'Title is required')
  .max(200, 'Title must be at most 200 characters')

const description = z
  .string()
  .trim()
  .max(5000, 'Description must be at most 5000 characters')

// null = unassigned
const assignedTo = z
  .number({ error: 'Assignee must be a user id' })
  .int()
  .positive()
  .nullable()

// "/issues/:id" → { id: number }
export const issueIdParams = z.object({
  id: z.coerce
    .number({ error: 'Issue id must be a number' })
    .int('Issue id must be a number')
    .positive('Issue id must be a number'),
})

// GET /issues?status=open&assignee=3&page=2&pageSize=10
// (assignee=unassigned for no assignee)
export const listIssuesQuery = z.object({
  status: status.optional(),
  assignee: z
    .union([z.literal('unassigned'), z.coerce.number().int().positive()])
    .optional(),
  page: z.coerce
    .number({ error: 'Page must be a number' })
    .int('Page must be a whole number')
    .min(1, 'Page must be 1 or more')
    .optional()
    .default(1),
  // Capped so nobody can ask for the whole table in one request.
  pageSize: z.coerce
    .number({ error: 'Page size must be a number' })
    .int('Page size must be a whole number')
    .min(1, 'Page size must be between 1 and 100')
    .max(100, 'Page size must be between 1 and 100')
    .optional()
    .default(10),
})

export const createIssueSchema = z.object({
  title,
  description: description.optional().default(''),
  status: status.optional().default('open'),
  assignedTo: assignedTo.optional().default(null),
})

// Admin edit: send only the fields that change.
export const updateIssueSchema = z
  .object({
    title: title.optional(),
    description: description.optional(),
    status: status.optional(),
    assignedTo: assignedTo.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    error: 'Nothing to update',
  })

export const updateStatusSchema = z.object({ status })

export const createCommentSchema = z.object({
  body: z
    .string({ error: 'Comment cannot be empty' })
    .trim()
    .min(1, 'Comment cannot be empty')
    .max(2000, 'Comment must be at most 2000 characters'),
})
