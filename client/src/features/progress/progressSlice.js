import { createSlice } from '@reduxjs/toolkit';
import { api } from '../../services/api.js';
import { apiThunk } from '../common/thunk.js';

export const fetchProgress = apiThunk('progress/mine', () => api('/progress/mine'));
export const fetchCustomerProgress = apiThunk('progress/customer', (id) => api(`/progress/customer/${id}`));
export const addProgress = apiThunk('progress/add', (data) => api('/progress', { method: 'POST', body: data }));
export const deleteProgress = apiThunk('progress/delete', async (id) => { await api(`/progress/${id}`, { method: 'DELETE' }); return id; });

const progressSlice = createSlice({
  name: 'progress',
  initialState: { items: [], heightCm: null, status: 'idle', error: null, save: { status: 'idle', error: null } },
  reducers: {
    clearProgressSave(state) {
      state.save = { status: 'idle', error: null };
    },
  },
  extraReducers: (builder) => {
    for (const t of [fetchProgress, fetchCustomerProgress]) {
      builder
        .addCase(t.pending, (s) => { s.status = 'loading'; s.error = null; })
        .addCase(t.fulfilled, (s, { payload }) => { s.status = 'ready'; s.items = payload.items; s.heightCm = payload.heightCm; })
        .addCase(t.rejected, (s, { payload }) => { s.status = 'failed'; s.error = payload; });
    }
    builder
      .addCase(addProgress.pending, (s) => { s.save = { status: 'loading', error: null }; })
      .addCase(addProgress.fulfilled, (s, { payload }) => {
        s.save = { status: 'done', error: null };
        s.items = [...s.items, payload.item].sort((a, b) => new Date(a.date) - new Date(b.date));
      })
      .addCase(addProgress.rejected, (s, { payload }) => { s.save = { status: 'failed', error: payload }; })
      .addCase(deleteProgress.fulfilled, (s, { payload }) => { s.items = s.items.filter((e) => e._id !== payload); });
  },
});

export const { clearProgressSave } = progressSlice.actions;
export default progressSlice.reducer;
export const selectProgress = (s) => s.progress;
