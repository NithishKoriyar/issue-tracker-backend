// An error we throw on purpose. The error middleware turns it into
// { error: { code, message } } with the given HTTP status.
export class ApiError extends Error {
  constructor(status, code, message) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

// Shortcuts for the common cases.
export const badRequest = (message, code = 'BAD_REQUEST') =>
  new ApiError(400, code, message)

export const unauthorized = (
  message = 'Authentication required',
  code = 'UNAUTHORIZED',
) => new ApiError(401, code, message)

export const forbidden = (
  message = 'You do not have permission to do this',
  code = 'FORBIDDEN',
) => new ApiError(403, code, message)

export const notFound = (message = 'Not found', code = 'NOT_FOUND') =>
  new ApiError(404, code, message)

export const conflict = (message, code = 'CONFLICT') =>
  new ApiError(409, code, message)
