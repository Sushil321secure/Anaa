import { createSlice } from '@reduxjs/toolkit';
import { api } from '../../services/api.js';
import { apiThunk } from '../common/thunk.js';

export const fetchMyPlans = apiThunk('dietplans/mine', () => api('/diet-plans/mine'));
export const fetchCustomerPlans = apiThunk('dietplans/customer', (id) => api(`/diet-plans/customer/${id}`));
export const uploadPlan = apiThunk('dietplans/upload', (formData) => api('/diet-plans', { method: 'POST', body: formData }));
export const deletePlan = apiThunk('dietplans/delete', async (id) => { await api(`/diet-plans/${id}`, { method: 'DELETE' }); return id; });

const dietPlanSlice = createSlice({
  name: 'dietPlans',
  initialState: { items: [], status: 'idle', error: null, upload: { status: 'idle', error: null } },
  reducers: {
    clearUpload(state) {
      state.upload = { status: 'idle', error: null };
    },
  },
  extraReducers: (builder) => {
    for (const t of [fetchMyPlans, fetchCustomerPlans]) {
      builder
        .addCase(t.pending, (s) => { s.status = 'loading'; s.error = null; })
        .addCase(t.fulfilled, (s, { payload }) => { s.status = 'ready'; s.items = payload.items; })
        .addCase(t.rejected, (s, { payload }) => { s.status = 'failed'; s.error = payload; });
    }
    builder
      .addCase(uploadPlan.pending, (s) => { s.upload = { status: 'loading', error: null }; })
      .addCase(uploadPlan.fulfilled, (s, { payload }) => { s.upload = { status: 'done', error: null }; s.items = [payload.plan, ...s.items]; })
      .addCase(uploadPlan.rejected, (s, { payload }) => { s.upload = { status: 'failed', error: payload }; })
      .addCase(deletePlan.fulfilled, (s, { payload }) => { s.items = s.items.filter((p) => p._id !== payload); });
  },
});

export const { clearUpload } = dietPlanSlice.actions;
export default dietPlanSlice.reducer;
export const selectDietPlans = (s) => s.dietPlans;
