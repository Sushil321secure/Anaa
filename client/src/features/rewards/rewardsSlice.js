import { createSlice } from '@reduxjs/toolkit';
import { api } from '../../services/api.js';
import { apiThunk } from '../common/thunk.js';

// Customer-facing Log & Earn state. Every number shown comes from the backend; the browser never calculates a balance or a discount.
export const fetchPublicProgram = apiThunk('rewards/program', () => api('/rewards/program'));
export const fetchWallet = apiThunk('rewards/wallet', () => api('/rewards/wallet')); // { verified, wallet, program, terms }
export const fetchTransactions = apiThunk('rewards/transactions', (page = 1) => api(`/rewards/transactions?page=${page}`));
export const fetchReferrals = apiThunk('rewards/referrals', () => api('/rewards/referrals'));
export const sendInvite = apiThunk('rewards/invite', (email) => api('/rewards/referrals', { method: 'POST', body: { email } }));
export const fetchQuote = apiThunk('rewards/quote', ({ packageId, points }) => api(`/rewards/quote?packageId=${packageId}${points ? `&points=${points}` : ''}`));

const rewardsSlice = createSlice({
  name: 'rewards',
  initialState: {
    program: { data: null, status: 'idle' },
    wallet: { data: null, status: 'idle', error: null },
    transactions: { items: [], page: 1, pages: 1, total: 0, status: 'idle' },
    referrals: { items: [], status: 'idle' },
    invite: { status: 'idle', error: null, devInviteLink: null, sent: null },
    quote: { data: null, status: 'idle', error: null },
  },
  reducers: {
    clearInvite(state) {
      state.invite = { status: 'idle', error: null, devInviteLink: null, sent: null };
    },
    clearQuote(state) {
      state.quote = { data: null, status: 'idle', error: null };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPublicProgram.fulfilled, (s, { payload }) => { s.program = { data: payload, status: 'ready' }; })
      .addCase(fetchPublicProgram.rejected, (s) => { s.program = { data: { enabled: false }, status: 'failed' }; })
      .addCase(fetchWallet.pending, (s) => { s.wallet.status = 'loading'; })
      .addCase(fetchWallet.fulfilled, (s, { payload }) => { s.wallet = { data: payload, status: 'ready', error: null }; })
      .addCase(fetchWallet.rejected, (s, { payload }) => { s.wallet.status = 'failed'; s.wallet.error = payload; })
      .addCase(fetchTransactions.pending, (s) => { s.transactions.status = 'loading'; })
      .addCase(fetchTransactions.fulfilled, (s, { payload }) => { s.transactions = { ...payload, status: 'ready' }; })
      .addCase(fetchTransactions.rejected, (s) => { s.transactions.status = 'failed'; })
      .addCase(fetchReferrals.fulfilled, (s, { payload }) => { s.referrals = { items: payload.items, status: 'ready' }; })
      .addCase(sendInvite.pending, (s) => { s.invite = { status: 'loading', error: null, devInviteLink: null, sent: null }; })
      .addCase(sendInvite.fulfilled, (s, { payload }) => {
        s.invite = { status: 'done', error: null, devInviteLink: payload.devInviteLink || null, sent: payload.referral.invitedEmail };
        s.referrals.items = [payload.referral, ...s.referrals.items];
      })
      .addCase(sendInvite.rejected, (s, { payload }) => { s.invite = { status: 'failed', error: payload, devInviteLink: null, sent: null }; })
      .addCase(fetchQuote.pending, (s) => { s.quote.status = 'loading'; s.quote.error = null; })
      .addCase(fetchQuote.fulfilled, (s, { payload }) => { s.quote = { data: payload.quote, status: 'ready', error: null }; })
      .addCase(fetchQuote.rejected, (s, { payload }) => { s.quote = { data: s.quote.data, status: 'failed', error: payload }; });
  },
});

export const { clearInvite, clearQuote } = rewardsSlice.actions;
export default rewardsSlice.reducer;
export const selectRewards = (s) => s.rewards;
