import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { api } from '../../services/api.js';

const toError = (err) => ({ message: err.message, details: err.details });

// Public
export const fetchTestimonials = createAsyncThunk('testimonials/fetch', async (_, { rejectWithValue }) => {
  try {
    return (await api('/testimonials')).items;
  } catch (err) {
    return rejectWithValue(toError(err));
  }
});

// Admin / owner
export const fetchAllTestimonials = createAsyncThunk('testimonials/fetchAll', async (_, { rejectWithValue }) => {
  try {
    return (await api('/testimonials/all')).items;
  } catch (err) {
    return rejectWithValue(toError(err));
  }
});

export const saveTestimonial = createAsyncThunk('testimonials/save', async ({ id, data }, { rejectWithValue }) => {
  try {
    const res = id
      ? await api(`/testimonials/${id}`, { method: 'PATCH', body: data })
      : await api('/testimonials', { method: 'POST', body: data });
    return res.item;
  } catch (err) {
    return rejectWithValue(toError(err));
  }
});

const testimonialSlice = createSlice({
  name: 'testimonials',
  initialState: { items: [], status: 'idle', admin: { items: [], status: 'idle', error: null, saveError: null } },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchTestimonials.pending, (s) => { s.status = 'loading'; })
      .addCase(fetchTestimonials.fulfilled, (s, { payload }) => { s.status = 'ready'; s.items = payload; })
      .addCase(fetchTestimonials.rejected, (s) => { s.status = 'failed'; })
      .addCase(fetchAllTestimonials.pending, (s) => { s.admin.status = 'loading'; s.admin.error = null; })
      .addCase(fetchAllTestimonials.fulfilled, (s, { payload }) => { s.admin.status = 'ready'; s.admin.items = payload; })
      .addCase(fetchAllTestimonials.rejected, (s, { payload }) => { s.admin.status = 'failed'; s.admin.error = payload?.message; })
      .addCase(saveTestimonial.pending, (s) => { s.admin.saveError = null; })
      .addCase(saveTestimonial.fulfilled, (s, { payload }) => {
        const i = s.admin.items.findIndex((t) => t._id === payload._id);
        if (i >= 0) s.admin.items[i] = payload; else s.admin.items.push(payload);
        s.status = 'idle'; // the public list is stale: it refetches next time it is shown
      })
      .addCase(saveTestimonial.rejected, (s, { payload }) => { s.admin.saveError = payload?.message || 'Could not save'; });
  },
});

export default testimonialSlice.reducer;
export const selectTestimonials = (s) => s.testimonials;
