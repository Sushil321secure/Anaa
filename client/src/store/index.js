import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../features/auth/authSlice.js';
import accountReducer from '../features/account/accountSlice.js';
import catalogReducer from '../features/catalog/catalogSlice.js';
import enquiryReducer from '../features/enquiries/enquirySlice.js';
import purchaseReducer from '../features/purchases/purchaseSlice.js';
import testimonialReducer from '../features/testimonials/testimonialSlice.js';
import appointmentReducer from '../features/appointments/appointmentSlice.js';
import progressReducer from '../features/progress/progressSlice.js';
import dietPlanReducer from '../features/dietplans/dietPlanSlice.js';
import rewardsReducer from '../features/rewards/rewardsSlice.js';
import adminRewardsReducer from '../features/rewards/adminRewardsSlice.js';
import staffReducer from '../features/staff/staffSlice.js';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    account: accountReducer,
    catalog: catalogReducer,
    enquiries: enquiryReducer,
    purchases: purchaseReducer,
    testimonials: testimonialReducer,
    appointments: appointmentReducer,
    progress: progressReducer,
    dietPlans: dietPlanReducer,
    rewards: rewardsReducer,
    adminRewards: adminRewardsReducer,
    staff: staffReducer,
  },
});
