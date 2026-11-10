export class AppError extends Error {
  constructor(status, code, message, details = null) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function errorHandler(error, req, res, next) { // eslint-disable-line no-unused-vars
  const known = error instanceof AppError;
  const status = known ? error.status : 500;
  const code = known ? error.code : 'INTERNAL_ERROR';
  const message = known ? error.message : 'An unexpected server error occurred.';
  req.log?.error({ requestId: req.id, errorName: error?.name, code }, 'request failed');
  res.status(status).json({
    success: false,
    data: null,
    error: {
      code,
      message,
      details: known ? error.details : null,
    },
  });
}
