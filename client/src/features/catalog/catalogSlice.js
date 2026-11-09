import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { api } from '../../services/api.js';

export const fetchCatalog = createAsyncThunk('catalog/fetch', async (_, { rejectWithValue }) => {
  try {
    const [services, packages] = await Promise.all([api('/services'), api('/packages')]);
    return { services: services.items, packages: packages.items };
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

const catalogSlice = createSlice({
  name: 'catalog',
  initialState: { services: [], packages: [], status: 'idle', error: null },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchCatalog.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchCatalog.fulfilled, (state, { payload }) => {
        state.status = 'ready';
        state.services = payload.services;
        state.packages = payload.packages;
      })
      .addCase(fetchCatalog.rejected, (state, { payload }) => {
        state.status = 'failed';
        state.error = payload;
      });
  },
});

export default catalogSlice.reducer;
export const selectCatalog = (s) => s.catalog;
