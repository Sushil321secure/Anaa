import { ZodError } from 'zod';
import { ApiError } from '../utils/http.js';
import { env } from '../config/env.js';

export function notFound(req, res) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    return res.status(400).json({ message: 'Validation failed', details: err.flatten().fieldErrors });
  }
  if (err instanceof ApiError) {
    return res.status(err.status).json({ message: err.message, details: err.details });
  }
  if (err?.code === 11000) {
    return res.status(409).json({ message: 'Duplicate value', details: err.keyValue });
  }
  console.error(err);
  res.status(500).json({ message: env.NODE_ENV === 'production' ? 'Internal server error' : err.message });
}
