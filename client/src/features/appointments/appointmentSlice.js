import { createSlice } from '@reduxjs/toolkit';
import { api } from '../../services/api.js';
import { apiThunk } from '../common/thunk.js';
import { fetchMyPurchases } from '../purchases/purchaseSlice.js';

export const fetchMyAppointments = apiThunk('appointments/mine', () => api('/appointments/mine'));
export const fetchSlots = apiThunk('appointments/slots', (date) => api(`/appointments/slots?date=${date}`));
export const fetchFees = apiThunk('appointments/fees', () => api('/appointments/fees'));
export const bookAppointment = apiThunk('appointments/book', async (data) => api('/appointments', { method: 'POST', body: data }));
export const cancelAppointment = apiThunk('appointments/cancel', (id) => api(`/appointments/${id}/cancel`, { method: 'POST' }));

// Booking or cancelling changes the remaining consultations, so refresh both lists afterwards.
export const bookAndRefresh = (data) => async (dispatch) => {
  const res = await dispatch(bookAppointment(data));
  if (bookAppointment.fulfilled.match(res)) {
    await Promise.all([dispatch(fetchMyAppointments()), dispatch(fetchMyPurchases())]);
  }
  return res;
};
export const cancelAndRefresh = (id) => async (dispatch) => {
  const res = await dispatch(cancelAppointment(id));
  if (cancelAppointment.fulfilled.match(res)) {
    await Promise.all([dispatch(fetchMyAppointments()), dispatch(fetchMyPurchases())]);
  }
  return res;
};

const appointmentSlice = createSlice({
  name: 'appointments',
  initialState: {
    items: [], cancelBeforeHours: 24, callWindow: { joinBeforeMinutes: 10, graceAfterMinutes: 15 }, status: 'idle', error: null,
    fees: { onlinePaise: 150000, offlinePaise: 100000 },
    slots: { date: null, items: [], slotMinutes: null, status: 'idle', error: null },
    action: { status: 'idle', error: null, message: null },
  },
  reducers: {
    clearAppointmentAction(state) {
      state.action = { status: 'idle', error: null, message: null };
    },
    setAppointmentError(state, { payload }) {
      state.action = { status: 'failed', error: { message: payload }, message: null };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMyAppointments.pending, (s) => { s.status = 'loading'; })
      .addCase(fetchMyAppointments.fulfilled, (s, { payload }) => { s.status = 'ready'; s.items = payload.items; s.cancelBeforeHours = payload.cancelBeforeHours; if (payload.callWindow) s.callWindow = payload.callWindow; })
      .addCase(fetchMyAppointments.rejected, (s, { payload }) => { s.status = 'failed'; s.error = payload; })
      .addCase(fetchFees.fulfilled, (s, { payload }) => { s.fees = payload; })
      .addCase(fetchSlots.pending, (s, { meta }) => { s.slots = { ...s.slots, date: meta.arg, status: 'loading', error: null }; })
      .addCase(fetchSlots.fulfilled, (s, { payload }) => { s.slots = { date: payload.date, items: payload.slots, slotMinutes: payload.slotMinutes, status: 'ready', error: null }; })
      .addCase(fetchSlots.rejected, (s, { payload }) => { s.slots.status = 'failed'; s.slots.error = payload; })
      .addCase(bookAppointment.pending, (s) => { s.action = { status: 'loading', error: null, message: null }; })
      .addCase(bookAppointment.fulfilled, (s) => { s.action = { status: 'done', error: null, message: 'Your consultation is booked.' }; })
      .addCase(bookAppointment.rejected, (s, { payload }) => { s.action = { status: 'failed', error: payload, message: null }; })
      .addCase(cancelAppointment.pending, (s) => { s.action = { status: 'loading', error: null, message: null }; })
      .addCase(cancelAppointment.fulfilled, (s, { payload }) => {
        s.action = { status: 'done', error: null, message: payload.consultationReturned ? 'Appointment cancelled. The consultation was returned to your package.' : 'Appointment cancelled. It was too close to the start time, so the consultation was not returned.' };
      })
      .addCase(cancelAppointment.rejected, (s, { payload }) => { s.action = { status: 'failed', error: payload, message: null }; });
  },
});

export const { clearAppointmentAction, setAppointmentError } = appointmentSlice.actions;
export default appointmentSlice.reducer;
export const selectAppointments = (s) => s.appointments;
