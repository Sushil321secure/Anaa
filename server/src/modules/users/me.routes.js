import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { User } from './user.model.js';
import { passwordField } from '../auth/auth.routes.js';
import { ApiError, asyncHandler } from '../../utils/http.js';
import { requireAuth } from '../../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const blankToUndefined = (s) => (s === '' ? undefined : s);

const profileSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.preprocess(blankToUndefined, z.string().trim().regex(/^[0-9+\-\s]{7,15}$/, 'Enter a valid phone number').optional()),
  dob: z.preprocess(blankToUndefined, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a valid date').optional()),
  gender: z.enum(['FEMALE', 'MALE', 'OTHER', '']).optional(),
  city: z.string().trim().max(80).optional(),
  heightCm: z.preprocess((v) => (v === '' || v === null ? undefined : v), z.number().min(50).max(250).optional()),
  healthGoal: z.string().trim().max(300).optional(),
}).partial();

router.patch('/', asyncHandler(async (req, res) => {
  const data = profileSchema.parse(req.body);
  if (data.dob && new Date(data.dob) > new Date()) throw new ApiError(400, 'Date of birth cannot be in the future');
  const set = { ...data, ...(data.dob && { dob: new Date(`${data.dob}T00:00:00.000Z`) }) };
  const unset = {};
  for (const k of ['phone', 'dob', 'heightCm']) if (k in req.body && data[k] === undefined) unset[k] = '';
  const user = await User.findByIdAndUpdate(req.user._id, { $set: set, ...(Object.keys(unset).length && { $unset: unset }) }, { new: true, runValidators: true });
  res.json({ user });
}));

router.post('/password', asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = z.object({ currentPassword: z.string().min(1), newPassword: passwordField }).parse(req.body);
  const user = await User.findById(req.user._id).select('+passwordHash');
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) throw new ApiError(400, 'Your current password is not correct', { currentPassword: ['Incorrect password'] });
  user.passwordHash = await bcrypt.hash(newPassword, 12);
  await user.save();
  res.json({ ok: true });
}));

export default router;
