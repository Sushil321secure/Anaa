import { createSlice } from '@reduxjs/toolkit';
import { api } from '../../services/api.js';
import { apiThunk } from '../common/thunk.js';

// Admin side of Log & Earn. The server enforces OWNER/ADMIN; this slice only carries data to the page.
const qs = (o) => {
  const p = new URLSearchParams();
  Object.entries(o || {}).forEach(([k, v]) => { if (v !== '' && v != null) p.set(k, v); });
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const fetchRewardConfig = apiThunk('adminRewards/config', () => api('/rewards/admin/config'));
export const saveRewardConfig = apiThunk('adminRewards/saveConfig', (body) => api('/rewards/admin/config', { method: 'PUT', body }));
export const fetchWallets = apiThunk('adminRewards/wallets', (o) => api(`/rewards/admin/wallets${qs(o)}`));
export const fetchTransactionsAdmin = apiThunk('adminRewards/transactions', (o) => api(`/rewards/admin/transactions${qs(o)}`));
export const fetchReferralsAdmin = apiThunk('adminRewards/referrals', (o) => api(`/rewards/admin/referrals${qs(o)}`));
export const approveReferral = apiThunk('adminRewards/approve', (id) => api(`/rewards/admin/referrals/${id}/approve`, { method: 'POST' }));
export const rejectReferral = apiThunk('adminRewards/reject', ({ id, reason }) => api(`/rewards/admin/referrals/${id}/reject`, { method: 'POST', body: { reason } }));
export const fetchRewardReport = apiThunk('adminRewards/report', (month) => api(`/rewards/admin/reports${qs({ month })}`));
export const runMaintenance = apiThunk('adminRewards/maintenance', () => api('/rewards/admin/maintenance/run', { method: 'POST' }));
export const adjustWallet = apiThunk('adminRewards/adjust', (body) => api('/rewards/admin/adjust', { method: 'POST', body }));

const list = { items: [], page: 1, pages: 1, total: 0, status: 'idle' };

const slice = createSlice({
  name: 'adminRewards',
  initialState: {
    config: { data: null, status: 'idle', error: null },
    wallets: { ...list },
    transactions: { ...list },
    referrals: { ...list },
    report: { data: null, status: 'idle' },
    action: { status: 'idle', error: null, message: null },
  },
  reducers: {
    clearAdminRewardsAction(s) { s.action = { status: 'idle', error: null, message: null }; },
  },
  extraReducers: (b) => {
    const write = (thunk, message, onOk) => b
      .addCase(thunk.pending, (s) => { s.action = { status: 'loading', error: null, message: null }; })
      .addCase(thunk.fulfilled, (s, { payload }) => { s.action = { status: 'done', error: null, message }; onOk?.(s, payload); })
      .addCase(thunk.rejected, (s, { payload }) => { s.action = { status: 'failed', error: payload, message: null }; });
    const read = (thunk, key) => b
      .addCase(thunk.pending, (s) => { s[key].status = 'loading'; })
      .addCase(thunk.fulfilled, (s, { payload }) => { s[key] = { ...payload, status: 'ready' }; })
      .addCase(thunk.rejected, (s) => { s[key].status = 'failed'; });
    read(fetchWallets, 'wallets');
    read(fetchTransactionsAdmin, 'transactions');
    read(fetchReferralsAdmin, 'referrals');
    b.addCase(fetchRewardConfig.fulfilled, (s, { payload }) => { s.config = { data: payload, status: 'ready', error: null }; })
      .addCase(fetchRewardConfig.rejected, (s, { payload }) => { s.config.status = 'failed'; s.config.error = payload; })
      .addCase(fetchRewardReport.pending, (s) => { s.report.status = 'loading'; })
      .addCase(fetchRewardReport.fulfilled, (s, { payload }) => { s.report = { data: payload, status: 'ready' }; })
      .addCase(fetchRewardReport.rejected, (s) => { s.report.status = 'failed'; });
    write(saveRewardConfig, 'Rewards settings saved.', (s, payload) => { s.config.data = payload; });
    write(approveReferral, 'Referral approved.');
    write(rejectReferral, 'Referral rejected.');
    write(runMaintenance, 'Maintenance run finished.');
    write(adjustWallet, 'Reward points adjusted.');
  },
});

export const { clearAdminRewardsAction } = slice.actions;
export default slice.reducer;
export const selectAdminRewards = (s) => s.adminRewards;
