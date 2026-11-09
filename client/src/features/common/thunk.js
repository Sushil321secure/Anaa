import { createAsyncThunk } from '@reduxjs/toolkit';

// Every request thunk rejects with a plain, serializable { message, details } so the store never holds Error objects.
export const apiThunk = (type, run) =>
  createAsyncThunk(type, async (arg, { rejectWithValue }) => {
    try {
      return await run(arg);
    } catch (err) {
      return rejectWithValue({ message: err.message, details: err.details, status: err.status });
    }
  });

export const toMessage = (payload) => payload?.message || 'Something went wrong';
