import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { originCheck } from './middleware/auth.js';
import healthRoutes from './modules/health/health.routes.js';
import authRoutes from './modules/auth/auth.routes.js';
import { serviceRoutes, packageRoutes } from './modules/catalog/catalog.routes.js';
import enquiryRoutes from './modules/enquiries/enquiry.routes.js';
import purchaseRoutes from './modules/purchases/purchase.routes.js';
import testimonialRoutes from './modules/testimonials/testimonial.routes.js';
import meRoutes from './modules/users/me.routes.js';
import appointmentRoutes, { staffAppointments } from './modules/appointments/appointment.routes.js';
import dietPlanRoutes from './modules/dietplans/dietplan.routes.js';
import progressRoutes from './modules/progress/progress.routes.js';
import rewardsRoutes from './modules/rewards/rewards.routes.js';
import consultationRoutes from './modules/consultations/consultation.routes.js';
import { sessionRoutes as yogaSessionRoutes, bookingRoutes as yogaBookingRoutes, publicYogaRoutes } from './modules/yoga/yoga.routes.js';
import meetConsultRoutes from './modules/meetconsult/meetconsult.routes.js';
import staffRoutes from './modules/staff/staff.routes.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  // Number of web servers in front of the API (1 = nginx only; 2 when a shared web server also sits in front of our nginx).
  app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS) || 1);

  app.use(helmet());
  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
  if (env.NODE_ENV !== 'test') app.use(morgan('tiny'));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use('/api', rateLimit({ windowMs: 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false }));
  app.use('/api', originCheck);

  app.use('/api/health', healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/services', serviceRoutes);
  app.use('/api/packages', packageRoutes);
  app.use('/api/enquiries', enquiryRoutes);
  app.use('/api/purchases', purchaseRoutes);
  app.use('/api/testimonials', testimonialRoutes);
  app.use('/api/me', meRoutes);
  app.use('/api/appointments', appointmentRoutes);
  app.use('/api/staff/appointments', staffAppointments);
  app.use('/api/diet-plans', dietPlanRoutes);
  app.use('/api/progress', progressRoutes);
  app.use('/api/rewards', rewardsRoutes);
  app.use('/api/consultations', consultationRoutes);
  app.use('/api/consultation-meet', meetConsultRoutes);
  app.use('/api/yoga-public', publicYogaRoutes);
  app.use('/api/yoga-sessions', yogaSessionRoutes);
  app.use('/api/yoga-bookings', yogaBookingRoutes);
  app.use('/api/staff', staffRoutes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
