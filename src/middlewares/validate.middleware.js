// validate({ body, params, query }) — runs zod schemas on the request.
// On failure zod throws a ZodError → errorHandler → 400 VALIDATION_ERROR.
// On success the parsed (trimmed, coerced, defaulted, unknown-keys-stripped)
// values are what controllers read:
//   body   → replaces req.body
//   params → req.validatedParams   (e.g. "/issues/7" → { id: 7 } as a number)
//   query  → req.validatedQuery    (Express 5's req.query is read-only)
export function validate({ body, params, query }) {
  return (req, _res, next) => {
    if (body) req.body = body.parse(req.body ?? {})
    if (params) req.validatedParams = params.parse(req.params)
    if (query) req.validatedQuery = query.parse(req.query)
    next()
  }
}
