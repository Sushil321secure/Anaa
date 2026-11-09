import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { z } from 'zod';
import { Enquiry, ENQUIRY_STATUSES } from './enquiry.model.js';
import { User, STAFF_ROLES } from '../users/user.model.js';
import { ApiError, asyncHandler, normalizeEmail } from '../../utils/http.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { sendTemplate } from '../mail/mailer.js';
import { audit } from '../audit/audit.model.js';

const router = Router();
const staff = [requireAuth, requireRole('OWNER', 'ADMIN', 'OPERATIONS')];

const submitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
});

const submitSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().transform(normalizeEmail),
  phone: z.string().trim().regex(/^[0-9+\-\s]{7,15}$/, 'Enter a valid phone number'),
  goal: z.string().trim().min(2).max(300),
  preferredAt: z.string().datetime().refine((d) => new Date(d) > new Date(), 'Preferred time must be in the future').optional(),
  message: z.string().trim().max(1000).optional(),
});

// Public discovery-call request
router.post('/', submitLimiter, asyncHandler(async (req, res) => {
  const data = submitSchema.parse(req.body);
  const enquiry = await Enquiry.create(data);
  // Not awaited so a slow SMTP server does not delay the visitor; sendTemplate never throws.
  sendTemplate(enquiry.email, 'enquiryConfirmation', enquiry);
  res.status(201).json({ enquiry: { _id: enquiry._id, status: enquiry.status } });
}));

// Staff members an enquiry can be assigned to
router.get('/assignees', ...staff, asyncHandler(async (req, res) => {
  const items = await User.find({ role: { $in: STAFF_ROLES }, isActive: true }).select('name role').sort('name').lean();
  res.json({ items });
}));

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

router.get('/', ...staff, asyncHandler(async (req, res) => {
  const { status, q } = z
    .object({ status: z.enum(ENQUIRY_STATUSES).optional(), q: z.string().trim().max(100).optional() })
    .parse(req.query);
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = 20;
  const filter = {};
  if (status) filter.status = status;
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ name: rx }, { email: rx }, { phone: rx }];
  }
  const [items, total] = await Promise.all([
    Enquiry.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('assignedTo', 'name').lean(),
    Enquiry.countDocuments(filter),
  ]);
  res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
}));

const updateSchema = z.object({
  status: z.enum(ENQUIRY_STATUSES).optional(),
  assignedTo: z.string().nullable().optional(),
  followUpAt: z.string().datetime().nullable().optional(),
});

router.patch('/:id', ...staff, asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(404, 'Enquiry not found');
  const changes = updateSchema.parse(req.body);
  const enquiry = await Enquiry.findById(req.params.id);
  if (!enquiry) throw new ApiError(404, 'Enquiry not found');

  let newAssignee = null;
  if (changes.assignedTo) {
    if (!mongoose.isValidObjectId(changes.assignedTo)) throw new ApiError(400, 'Invalid assignee');
    newAssignee = await User.findOne({ _id: changes.assignedTo, role: { $in: STAFF_ROLES }, isActive: true });
    if (!newAssignee) throw new ApiError(400, 'Assignee must be an active staff member');
  }
  const reassigned = !!changes.assignedTo && String(enquiry.assignedTo) !== changes.assignedTo;

  if (changes.status) enquiry.status = changes.status;
  if ('assignedTo' in changes) enquiry.assignedTo = changes.assignedTo || undefined;
  if ('followUpAt' in changes) enquiry.followUpAt = changes.followUpAt ? new Date(changes.followUpAt) : undefined;
  await enquiry.save();

  await audit(req.user._id, 'enquiry.update', 'enquiry', enquiry._id, changes);
  if (reassigned) sendTemplate(newAssignee.email, 'enquiryAssigned', { staffName: newAssignee.name, enquiry });

  await enquiry.populate('assignedTo', 'name');
  res.json({ enquiry });
}));

export default router;
