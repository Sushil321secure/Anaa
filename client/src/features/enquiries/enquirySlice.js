import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { api } from '../../services/api.js';

const toError = (err) => ({ message: err.message, details: err.details });

// Public discovery-call form
export const submitEnquiry = createAsyncThunk('enquiries/submit', async (payload, { rejectWithValue }) => {
  try {
    return (await api('/enquiries', { method: 'POST', body: payload })).enquiry;
  } catch (err) {
    return rejectWithValue(toError(err));
  }
});

// Staff
export const fetchEnquiries = createAsyncThunk('enquiries/fetch', async (params = {}, { rejectWithValue }) => {
  try {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
    return await api(`/enquiries${qs ? `?${qs}` : ''}`);
  } catch (err) {
    return rejectWithValue(toError(err));
  }
});

export const updateEnquiry = createAsyncThunk('enquiries/update', async ({ id, changes }, { rejectWithValue }) => {
  try {
    return (await api(`/enquiries/${id}`, { method: 'PATCH', body: changes })).enquiry;
  } catch (err) {
    return rejectWithValue(toError(err));
  }
});

export const fetchAssignees = createAsyncThunk('enquiries/assignees', async (_, { rejectWithValue }) => {
  try {
    return (await api('/enquiries/assignees')).items;
  } catch (err) {
    return rejectWithValue(toError(err));
  }
});

const enquirySlice = createSlice({
  name: 'enquiries',
  initialState: {
    submit: { status: 'idle', error: null },
    list: { items: [], total: 0, page: 1, pages: 1, status: 'idle', error: null },
    assignees: [],
    saveError: null,
  },
  reducers: {
    resetSubmit(state) {
      state.submit = { status: 'idle', error: null };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(submitEnquiry.pending, (state) => {
        state.submit = { status: 'loading', error: null };
      })
      .addCase(submitEnquiry.fulfilled, (state) => {
        state.submit = { status: 'done', error: null };
      })
      .addCase(submitEnquiry.rejected, (state, { payload }) => {
        state.submit = { status: 'failed', error: payload };
      })
      .addCase(fetchEnquiries.pending, (state) => {
        state.list.status = 'loading';
        state.list.error = null;
      })
      .addCase(fetchEnquiries.fulfilled, (state, { payload }) => {
        state.list = { ...payload, status: 'ready', error: null };
      })
      .addCase(fetchEnquiries.rejected, (state, { payload }) => {
        state.list.status = 'failed';
        state.list.error = payload?.message;
      })
      .addCase(updateEnquiry.pending, (state) => {
        state.saveError = null;
      })
      .addCase(updateEnquiry.fulfilled, (state, { payload }) => {
        const i = state.list.items.findIndex((e) => e._id === payload._id);
        if (i >= 0) state.list.items[i] = payload;
      })
      .addCase(updateEnquiry.rejected, (state, { payload }) => {
        state.saveError = payload?.message;
      })
      .addCase(fetchAssignees.fulfilled, (state, { payload }) => {
        state.assignees = payload;
      });
  },
});

export const { resetSubmit } = enquirySlice.actions;
export default enquirySlice.reducer;
