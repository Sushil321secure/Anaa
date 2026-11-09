import { Router } from 'express';
import { z } from 'zod';
import { Testimonial } from './testimonial.model.js';
import { ApiError, asyncHandler } from '../../utils/http.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { audit } from '../audit/audit.model.js';
import { originalTestimonials } from '../../seeds/testimonials.data.js';

export const testimonialSchema = z.object({
  name: z.string().trim().min(2).max(120),
  quote: z.string().min(2).max(2000),
  isPublished: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

// The database is the single source of testimonials. The first time it is found completely empty, the four
// original testimonials from the previous website are stored (idempotent upserts), so a fresh install shows
// them without a separate seed step. After that, admins manage them; deleting or unpublishing never re-adds.
let defaultsChecked = false;
async function ensureOriginalTestimonials() {
  if (defaultsChecked) return;
  if ((await Testimonial.estimatedDocumentCount()) === 0) {
    await Testimonial.bulkWrite(originalTestimonials.map((t, i) => ({
      updateOne: { filter: { name: t.name }, update: { $setOnInsert: { ...t, sortOrder: i + 1, isPublished: true } }, upsert: true },
    })));
  }
  defaultsChecked = true;
}

const router = Router();
const manage = [requireAuth, requireRole('OWNER', 'ADMIN')];

// Public: published testimonials only
router.get('/', asyncHandler(async (req, res) => {
  await ensureOriginalTestimonials();
  res.json({ items: await Testimonial.find({ isPublished: true }).sort({ sortOrder: 1, createdAt: 1 }).lean() });
}));

// Managers: everything, including unpublished
router.get('/all', ...manage, asyncHandler(async (req, res) => {
  res.json({ items: await Testimonial.find().sort({ sortOrder: 1, createdAt: 1 }).lean() });
}));

router.post('/', ...manage, asyncHandler(async (req, res) => {
  const data = testimonialSchema.parse(req.body);
  const doc = await Testimonial.create(data);
  await audit(req.user._id, 'testimonial.create', 'testimonial', doc._id, { name: data.name });
  res.status(201).json({ item: doc });
}));

router.patch('/:id', ...manage, asyncHandler(async (req, res) => {
  const data = testimonialSchema.partial().parse(req.body);
  const doc = await Testimonial.findByIdAndUpdate(req.params.id, { $set: data }, { new: true, runValidators: true });
  if (!doc) throw new ApiError(404, 'Testimonial not found');
  await audit(req.user._id, 'testimonial.update', 'testimonial', doc._id, Object.keys(data));
  res.json({ item: doc });
}));

export default router;
