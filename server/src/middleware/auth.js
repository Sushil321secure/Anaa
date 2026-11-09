import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError, asyncHandler } from '../utils/http.js';
import { User } from '../modules/users/user.model.js';

export const COOKIE_NAME = 'anaa_token';

export function signToken(user) {
  return jwt.sign({ sub: String(user._id), role: user.role }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });
}

export const cookieOptions = {
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
};

export const requireAuth = asyncHandler(async (req, res, next) => {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) throw new ApiError(401, 'Authentication required');
  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET);
  } catch {
    throw new ApiError(401, 'Session expired, please log in again');
  }
  const user = await User.findById(payload.sub);
  if (!user || !user.isActive) throw new ApiError(401, 'Account unavailable');
  req.user = user;
  next();
});

// Role-based access control. Record-level ownership checks live in each module.
export const requireRole =
  (...roles) =>
  (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) return next(new ApiError(403, 'Forbidden'));
    next();
  };

// Basic CSRF defence for cookie auth: state-changing requests must come from the allowed origin.
export function originCheck(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('origin');
  if (origin && origin !== env.CLIENT_ORIGIN) return next(new ApiError(403, 'Origin not allowed'));
  next();
}
