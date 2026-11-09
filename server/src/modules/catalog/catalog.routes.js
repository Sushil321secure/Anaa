import { Router } from 'express';
import { z } from 'zod';
import { Service, Package, PACKAGE_BADGES } from './catalog.model.js';
import { computePricing } from './pricing.js';
import { ApiError, asyncHandler } from '../../utils/http.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { audit } from '../audit/audit.model.js';

const slugify = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const input = {
  name: z.string().trim().min(2).max(120),
  summary: z.string().trim().min(2).max(400),
  pricePaise: z.number().int().min(0).nullable().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
};
const serviceSchema = z.object({ ...input, durationMinutes: z.number().int().min(5).max(480).optional() });
const packageSchema = z.object({
  ...input,
  durationDays: z.number().int().min(1).optional(),
  referenceMonthlyPaise: z.number().int().min(0).nullable().optional(),
  badge: z.enum(PACKAGE_BADGES).nullable().optional(),
  tagline: z.string().trim().max(160).optional(),
  bestFor: z.string().trim().max(300).optional(),
  initialConsultMinutes: z.number().int().min(5).max(480).optional(),
  followUpConsults: z.number().int().min(0).max(50).optional(),
  dietPlans: z.number().int().min(0).max(50).optional(),
  dietRevisionsLabel: z.string().trim().max(80).optional(),
  features: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
});

// `decorate` adds server-computed fields (e.g. package pricing) to every item that leaves the API.
function crud(Model, schema, label, decorate = (d) => d) {
  const router = Router();
  const manage = [requireAuth, requireRole('OWNER', 'ADMIN')];
  const out = (doc) => decorate(typeof doc.toObject === 'function' ? doc.toObject() : doc);

  // Public: active items only
  router.get('/', asyncHandler(async (req, res) => {
    const items = await Model.find({ isActive: true }).sort({ sortOrder: 1, name: 1 }).lean();
    res.json({ items: items.map(out) });
  }));

  // Managers: everything, including inactive
  router.get('/all', ...manage, asyncHandler(async (req, res) => {
    const items = await Model.find().sort({ sortOrder: 1, name: 1 }).lean();
    res.json({ items: items.map(out) });
  }));

  router.post('/', ...manage, asyncHandler(async (req, res) => {
    const data = schema.parse(req.body);
    const doc = await Model.create({ ...data, slug: slugify(data.name) });
    await audit(req.user._id, `${label}.create`, label, doc._id, data);
    res.status(201).json({ item: out(doc) });
  }));

  router.patch('/:id', ...manage, asyncHandler(async (req, res) => {
    const data = schema.partial().parse(req.body);
    const doc = await Model.findByIdAndUpdate(req.params.id, { $set: data }, { new: true, runValidators: true });
    if (!doc) throw new ApiError(404, `${label} not found`);
    await audit(req.user._id, `${label}.update`, label, doc._id, data);
    res.json({ item: out(doc) });
  }));

  return router;
}

export const serviceRoutes = crud(Service, serviceSchema, 'service');
export const packageRoutes = crud(Package, packageSchema, 'package', (p) => ({ ...p, pricing: computePricing(p) }));
