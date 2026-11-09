import { Router } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import multer from 'multer';
import { z } from 'zod';
import { DietPlan } from './dietplan.model.js';
import { User } from '../users/user.model.js';
import { ApiError, asyncHandler } from '../../utils/http.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { sendTemplate } from '../mail/mailer.js';
import { audit } from '../audit/audit.model.js';

export const STORAGE_DIR = path.resolve(process.cwd(), 'storage', 'diet-plans');
fs.mkdirSync(STORAGE_DIR, { recursive: true });

const ALLOWED = { 'application/pdf': '.pdf', 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const MAX_BYTES = 8 * 1024 * 1024;

const upload = multer({
  storage: multer.diskStorage({
    destination: STORAGE_DIR,
    filename: (req, file, cb) => cb(null, `${crypto.randomUUID()}${ALLOWED[file.mimetype] || ''}`),
  }),
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (req, file, cb) => (ALLOWED[file.mimetype] ? cb(null, true) : cb(new ApiError(400, 'Only PDF, JPG, PNG or WebP files are allowed'))),
});

const router = Router();
const writers = [requireAuth, requireRole('OWNER', 'ADMIN', 'DIETITIAN')];
const readers = [requireAuth, requireRole('OWNER', 'ADMIN', 'DIETITIAN', 'OPERATIONS')];

const bodySchema = z.object({
  customerId: z.string().refine(mongoose.isValidObjectId, 'Invalid customer'),
  title: z.string().trim().min(2).max(160),
  notes: z.string().trim().max(1000).optional(),
  validFrom: z.string().optional(),
  validTo: z.string().optional(),
});

const removeFile = (storedName) => fs.promises.unlink(path.join(STORAGE_DIR, storedName)).catch(() => {});
const view = (p) => ({ _id: p._id, title: p.title, notes: p.notes, validFrom: p.validFrom, validTo: p.validTo, createdAt: p.createdAt, fileName: p.file.originalName, mime: p.file.mime, size: p.file.size, uploadedBy: p.uploadedBy });

// Staff: upload a plan for a customer
router.post('/', ...writers, upload.single('file'), asyncHandler(async (req, res) => {
  try {
    if (!req.file) throw new ApiError(400, 'Choose a file to upload');
    const data = bodySchema.parse(req.body);
    const customer = await User.findOne({ _id: data.customerId, role: 'CUSTOMER' });
    if (!customer) throw new ApiError(404, 'Customer not found');
    const plan = await DietPlan.create({
      customer: customer._id,
      uploadedBy: req.user._id,
      title: data.title,
      notes: data.notes,
      validFrom: data.validFrom ? new Date(data.validFrom) : undefined,
      validTo: data.validTo ? new Date(data.validTo) : undefined,
      file: { storedName: req.file.filename, originalName: path.basename(req.file.originalname).slice(0, 160), mime: req.file.mimetype, size: req.file.size },
    });
    sendTemplate(customer.email, 'dietPlanReady', { name: customer.name, title: plan.title });
    await audit(req.user._id, 'dietplan.upload', 'dietplan', plan._id, { customer: customer._id, title: plan.title });
    res.status(201).json({ plan: view(plan) });
  } catch (err) {
    if (req.file) await removeFile(req.file.filename); // do not keep orphan files when validation fails
    throw err;
  }
}));

// Staff: plans of one customer
router.get('/customer/:customerId', ...readers, asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.customerId)) throw new ApiError(404, 'Customer not found');
  const items = await DietPlan.find({ customer: req.params.customerId }).populate('uploadedBy', 'name').sort({ createdAt: -1 });
  res.json({ items: items.map(view) });
}));

router.delete('/:id', ...writers, asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(404, 'Plan not found');
  const plan = await DietPlan.findById(req.params.id);
  if (!plan) throw new ApiError(404, 'Plan not found');
  if (req.user.role === 'DIETITIAN' && String(plan.uploadedBy) !== String(req.user._id)) throw new ApiError(403, 'You can only remove plans you uploaded');
  await plan.deleteOne();
  await removeFile(plan.file.storedName);
  await audit(req.user._id, 'dietplan.delete', 'dietplan', plan._id, { title: plan.title });
  res.json({ ok: true });
}));

// Customer: own plans
router.get('/mine', requireAuth, requireRole('CUSTOMER'), asyncHandler(async (req, res) => {
  const items = await DietPlan.find({ customer: req.user._id }).populate('uploadedBy', 'name').sort({ createdAt: -1 });
  res.json({ items: items.map(view) });
}));

// Download: the owning customer or any staff role. Files are never exposed as static assets.
router.get('/:id/file', requireAuth, asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(404, 'Plan not found');
  const plan = await DietPlan.findById(req.params.id);
  if (!plan) throw new ApiError(404, 'Plan not found');
  const isOwner = req.user.role === 'CUSTOMER' && String(plan.customer) === String(req.user._id);
  if (!isOwner && req.user.role === 'CUSTOMER') throw new ApiError(404, 'Plan not found'); // do not reveal that it exists
  const full = path.join(STORAGE_DIR, plan.file.storedName);
  if (!full.startsWith(STORAGE_DIR) || !fs.existsSync(full)) throw new ApiError(404, 'File is missing');
  res.set({
    'Content-Type': plan.file.mime,
    'Content-Disposition': `attachment; filename="${plan.file.originalName.replace(/[^\w.\- ]/g, '_')}"`,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, no-store',
  });
  fs.createReadStream(full).pipe(res);
}));

// multer errors (size limit) become friendly 4xx responses
// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) return next(new ApiError(400, err.code === 'LIMIT_FILE_SIZE' ? 'File is too large (maximum 8 MB)' : err.message));
  return next(err);
});

export default router;
