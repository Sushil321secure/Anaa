import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { api } from '../../services/api.js';
import { checkoutImage } from '../../utils/checkoutBrand.js';

const toError = (err) => ({ message: err.message, details: err.details });

let checkoutScript;
function loadCheckoutScript() {
  if (window.Razorpay) return Promise.resolve();
  checkoutScript ||= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = resolve;
    s.onerror = () => { checkoutScript = undefined; reject(new Error('Could not load the payment window. Check your connection.')); };
    document.body.appendChild(s);
  });
  return checkoutScript;
}

export const fetchMyPurchases = createAsyncThunk('purchases/fetchMine', async (_, { rejectWithValue }) => {
  try {
    return (await api('/purchases/mine')).items;
  } catch (err) {
    return rejectWithValue(toError(err));
  }
});

// Creates the order on the server (amount comes from the database), opens Razorpay, then asks the
// server to verify the signature. The package is activated only by that verification.
export const buyPackage = createAsyncThunk('purchases/buy', async (arg, { dispatch, rejectWithValue }) => {
  const { packageId, redeemPoints, mode } = typeof arg === 'string' ? { packageId: arg } : arg; // mode = pay-as-you-go consultation (ONLINE or OFFLINE)
  let order;
  let abandoned = false;
  try {
    order = mode
      ? await api('/purchases/consultation-checkout', { method: 'POST', body: { mode } })
      : await api('/purchases/checkout', { method: 'POST', body: { packageId, ...(redeemPoints ? { redeemPoints } : {}) } });
    abandoned = true; // from here until the payment window returns a payment, closing it abandons the order
    await loadCheckoutScript();
    const paid = await new Promise((resolve, reject) => {
      const rzp = new window.Razorpay({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amountPaise,
        currency: 'INR',
        name: 'Anaa Nutricare',
        image: checkoutImage(),
        description: order.packageName,
        prefill: order.prefill,
        theme: { color: '#5b1f9e' },
        handler: resolve,
        modal: { ondismiss: () => reject(new Error('Payment was cancelled. You have not been charged and any points you used are returned.')) },
      });
      rzp.on?.('payment.failed', () => reject(new Error('The payment failed. You have not been charged and any points you used are returned.')));
      rzp.open();
    });
    abandoned = false;
    const { purchase } = await api('/purchases/verify', { method: 'POST', body: paid });
    dispatch(fetchMyPurchases());
    return purchase;
  } catch (err) {
    // The payment never completed: tell the server so reserved reward points are released straight away.
    if (order && abandoned) await api('/purchases/cancel', { method: 'POST', body: { razorpay_order_id: order.orderId } }).catch(() => {});
    return rejectWithValue(toError(err));
  }
});

const purchaseSlice = createSlice({
  name: 'purchases',
  initialState: { items: [], status: 'idle', buying: null, error: null, lastPurchase: null },
  reducers: {
    clearPurchaseMessage(state) {
      state.error = null;
      state.lastPurchase = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMyPurchases.pending, (state) => { state.status = 'loading'; })
      .addCase(fetchMyPurchases.fulfilled, (state, { payload }) => { state.status = 'ready'; state.items = payload; })
      .addCase(fetchMyPurchases.rejected, (state) => { state.status = 'failed'; })
      .addCase(buyPackage.pending, (state, { meta }) => { state.buying = meta.arg.mode ? `consultation-${meta.arg.mode}` : meta.arg.packageId || meta.arg; state.error = null; state.lastPurchase = null; })
      .addCase(buyPackage.fulfilled, (state, { payload }) => { state.buying = null; state.lastPurchase = payload; })
      .addCase(buyPackage.rejected, (state, { payload }) => { state.buying = null; state.error = payload; });
  },
});

export const { clearPurchaseMessage } = purchaseSlice.actions;
export default purchaseSlice.reducer;
export const selectPurchases = (s) => s.purchases;
