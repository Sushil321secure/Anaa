import { createSlice } from '@reduxjs/toolkit';
import { api } from '../../services/api.js';
import { apiThunk } from '../common/thunk.js';
import { setUser } from '../auth/authSlice.js';

export const updateProfile = apiThunk('account/updateProfile', async (data) => (await api('/me', { method: 'PATCH', body: data })).user);
export const changePassword = apiThunk('account/changePassword', (data) => api('/me/password', { method: 'POST', body: data }));
export const forgotPassword = apiThunk('account/forgot', (email) => api('/auth/forgot-password', { method: 'POST', body: { email } }));
export const resetPassword = apiThunk('account/reset', (data) => api('/auth/reset-password', { method: 'POST', body: data }));

const initial = { status: 'idle', error: null, message: null, devResetLink: null };

const accountSlice = createSlice({
  name: 'account',
  initialState: { profile: { ...initial }, password: { ...initial }, forgot: { ...initial }, reset: { ...initial } },
  reducers: {
    clearAccount(state) {
      state.profile = { ...initial };
      state.password = { ...initial };
      state.forgot = { ...initial };
      state.reset = { ...initial };
    },
  },
  extraReducers: (builder) => {
    const wire = (thunk, key, onOk) => {
      builder
        .addCase(thunk.pending, (s) => { s[key] = { ...initial, status: 'loading' }; })
        .addCase(thunk.fulfilled, (s, { payload }) => { s[key] = { ...initial, status: 'done', ...(onOk ? onOk(payload) : {}) }; })
        .addCase(thunk.rejected, (s, { payload }) => { s[key] = { ...initial, status: 'failed', error: payload }; });
    };
    wire(updateProfile, 'profile');
    wire(changePassword, 'password');
    wire(forgotPassword, 'forgot', (p) => ({ message: p.message, devResetLink: p.devResetLink || null }));
    wire(resetPassword, 'reset');
  },
});

// Keep the signed-in user in the auth slice in step with a saved profile.
export const saveProfile = (data) => async (dispatch) => {
  const res = await dispatch(updateProfile(data));
  if (updateProfile.fulfilled.match(res)) dispatch(setUser(res.payload));
  return res;
};

export const { clearAccount } = accountSlice.actions;
export default accountSlice.reducer;
export const selectAccount = (s) => s.account;
