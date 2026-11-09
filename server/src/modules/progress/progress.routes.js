import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { ProgressEntry } from './progress.model.js';
import { User } from '../users/user.model.js';
import { ApiError, asyncHandler } from '../../utils/http.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';

const router = Router();
const customerOnly = [requireAuth, requireRole('CUSTOMER')];
const staff = [requireAuth, requireRole('OWNER', 'ADMIN', 'DIETITIAN', 'OPERATIONS')];

const num = (min, max) => z.number().min(min).max(max).optional();
const entrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date'),
  weightKg: num(10, 400),
  waistCm: num(30, 250),
  bodyFatPct: num(2, 70),
  notes: z.string().trim().max(300).optional(),
}).refine((e) => e.weightKg != null || e.waistCm != null || e.bodyFatPct != null, { message: 'Enter at least one measurement' });

// BMI is derived from the profile height, never stored.
const withBmi = (heightCm) => (e) => ({ ...e, bmi: heightCm && e.weightKg ? Math.round((e.weightKg / ((heightCm / 100) ** 2)) * 10) / 10 : null });

router.get('/mine', ...customerOnly, asyncHandler(async (req, res) => {
  const items = await ProgressEntry.find({ customer: req.user._id }).sort({ date: 1 }).limit(500).lean();
  res.json({ items: items.map(withBmi(req.user.heightCm)), heightCm: req.user.heightCm ?? null });
}));

router.post('/', ...customerOnly, asyncHandler(async (req, res) => {
  const data = entrySchema.parse(req.body);
  const date = new Date(`${data.date}T00:00:00.000Z`);
  if (date.getTime() > Date.now() + 24 * 3600 * 1000) throw new ApiError(400, 'The date cannot be in the future');
  const entry = await ProgressEntry.create({ ...data, date, customer: req.user._id });
  res.status(201).json({ item: withBmi(req.user.heightCm)(entry.toObject()) });
}));

router.delete('/:id', ...customerOnly, asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(404, 'Entry not found');
  const del = await ProgressEntry.findOneAndDelete({ _id: req.params.id, customer: req.user._id });
  if (!del) throw new ApiError(404, 'Entry not found');
  res.json({ ok: true });
}));

// Staff can read a customer's progress
router.get('/customer/:customerId', ...staff, asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.customerId)) throw new ApiError(404, 'Customer not found');
  const customer = await User.findOne({ _id: req.params.customerId, role: 'CUSTOMER' }).select('heightCm');
  if (!customer) throw new ApiError(404, 'Customer not found');
  const items = await ProgressEntry.find({ customer: customer._id }).sort({ date: 1 }).limit(500).lean();
  res.json({ items: items.map(withBmi(customer.heightCm)), heightCm: customer.heightCm ?? null });
}));

export default router;
