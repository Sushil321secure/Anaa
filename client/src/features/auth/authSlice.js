import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { api } from '../../services/api.js';

// Rejected values are plain objects so the store stays serializable.
const toError = (err) => ({ message: err.message, details: err.details });

export const fetchMe = createAsyncThunk('auth/fetchMe', async (_, { rejectWithValue }) => {
  try {
    return (await api('/auth/me')).user;
  } catch (err) {
    return rejectWithValue(toError(err));
  }
});

export const login = createAsyncThunk('auth/login', async ({ email, password }, { rejectWithValue }) => {
  try {
    return (await api('/auth/login', { method: 'POST', body: { email, password } })).user;
  } catch (err) {
    return rejectWithValue(toError(err));
  }
});

export const register = createAsyncThunk('auth/register', async (payload, { rejectWithValue }) => {
  try {
    return await api('/auth/register', { method: 'POST', body: payload }); // { user, devVerifyLink }
  } catch (err) {
    return rejectWithValue(toError(err));
  }
});

export const verifyEmail = createAsyncThunk('auth/verifyEmail', async (token, { rejectWithValue }) => {
  try {
    return await api('/auth/verify-email', { method: 'POST', body: { token } }); // { ok, user, pointsEarned }
  } catch (err) {
    return rejectWithValue(toError(err));
  }
});

export const resendVerification = createAsyncThunk('auth/resendVerification', async (_, { dispatch, rejectWithValue }) => {
  try {
    const res = await api('/auth/resend-verification', { method: 'POST' });
    dispatch(setVerifyLink(res.devVerifyLink || null));
    return res;
  } catch (err) {
    return rejectWithValue(toError(err));
  }
});

export const logout = createAsyncThunk('auth/logout', async () => {
  await api('/auth/logout', { method: 'POST' });
});

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null,
    initializing: true, // true until the first /auth/me check finishes
    status: 'idle', // idle | loading (login/register in flight)
    error: null,
    devVerifyLink: null, // local development only: the server returns the verification link when no SMTP is configured
  },
  reducers: {
    clearAuthError(state) {
      state.error = null;
    },
    setUser(state, { payload }) {
      state.user = payload;
    },
    setVerifyLink(state, { payload }) {
      state.devVerifyLink = payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMe.fulfilled, (state, { payload }) => {
        state.user = payload;
        state.initializing = false;
      })
      .addCase(fetchMe.rejected, (state) => {
        state.user = null;
        state.initializing = false;
      })
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
      });

    for (const thunk of [login, register]) {
      builder
        .addCase(thunk.pending, (state) => {
          state.status = 'loading';
          state.error = null;
        })
        .addCase(thunk.fulfilled, (state, { payload }) => {
          state.status = 'idle';
          if (thunk === register) {
            state.user = payload.user;
            state.devVerifyLink = payload.devVerifyLink || null;
          } else {
            state.user = payload;
          }
        })
        .addCase(thunk.rejected, (state, { payload }) => {
          state.status = 'idle';
          state.error = payload || { message: 'Something went wrong' };
        });
    }
  },
});

export const { clearAuthError, setUser, setVerifyLink } = authSlice.actions;
export default authSlice.reducer;

export const selectUser = (s) => s.auth.user;
export const selectAuthInitializing = (s) => s.auth.initializing;
export const selectAuthStatus = (s) => s.auth.status;
export const selectAuthError = (s) => s.auth.error;
export const selectVerifyLink = (s) => s.auth.devVerifyLink;

export const STAFF_ROLES = ['OWNER', 'ADMIN', 'DIETITIAN', 'OPERATIONS'];
export const MANAGER_ROLES = ['OWNER', 'ADMIN'];
export const homeFor = (user) => (STAFF_ROLES.includes(user?.role) ? '/admin' : '/portal');
