import { createSlice } from '@reduxjs/toolkit';
import { api } from '../../services/api.js';
import { apiThunk } from '../common/thunk.js';

const qs = (params = {}) => {
  const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')).toString();
  return s ? `?${s}` : '';
};

export const fetchStats = apiThunk('staff/stats', () => api('/staff/stats'));
export const fetchDietitians = apiThunk('staff/dietitians', () => api('/staff/dietitians'));
export const fetchCustomers = apiThunk('staff/customers', (params) => api(`/staff/customers${qs(params)}`));
export const fetchCustomerDetail = apiThunk('staff/customerDetail', (id) => api(`/staff/customers/${id}`));
export const assignPackage = apiThunk('staff/assignPackage', ({ customerId, ...body }) => api(`/staff/customers/${customerId}/packages`, { method: 'POST', body }));
export const adjustRewards = apiThunk('staff/adjustRewards', (body) => api('/rewards/admin/adjust', { method: 'POST', body }));

export const fetchStaffAppointments = apiThunk('staff/appointments', (params) => api(`/staff/appointments${qs(params)}`));
export const updateStaffAppointment = apiThunk('staff/appointmentUpdate', ({ id, changes }) => api(`/staff/appointments/${id}`, { method: 'PATCH', body: changes }));

export const fetchStaffUsers = apiThunk('staff/users', () => api('/staff/users'));
export const createStaffUser = apiThunk('staff/userCreate', (body) => api('/staff/users', { method: 'POST', body }));
export const updateStaffUser = apiThunk('staff/userUpdate', ({ id, changes }) => api(`/staff/users/${id}`, { method: 'PATCH', body: changes }));

export const fetchSettings = apiThunk('staff/settings', () => api('/staff/settings'));
export const saveSettings = apiThunk('staff/settingsSave', async ({ key, value }) => ({ key, ...(await api(`/staff/settings/${key}`, { method: 'PUT', body: value })) }));

// Catalogue (packages and services) management
export const fetchAdminCatalog = apiThunk('staff/catalog', async () => {
  const [packages, services] = await Promise.all([api('/packages/all'), api('/services/all')]);
  return { packages: packages.items, services: services.items };
});
export const saveCatalogItem = apiThunk('staff/catalogSave', async ({ kind, id, data }) => {
  const res = id ? await api(`/${kind}/${id}`, { method: 'PATCH', body: data }) : await api(`/${kind}`, { method: 'POST', body: data });
  return { kind, item: res.item };
});

const load = { status: 'idle', error: null };

const staffSlice = createSlice({
  name: 'staff',
  initialState: {
    stats: { ...load, data: null },
    dietitians: [],
    customers: { ...load, items: [], total: 0, page: 1, pages: 1 },
    detail: { ...load, data: null },
    appointments: { ...load, items: [], callWindow: { joinBeforeMinutes: 10, graceAfterMinutes: 15 } },
    users: { ...load, items: [] },
    settings: { ...load, data: null },
    catalog: { ...load, packages: [], services: [] },
    action: { status: 'idle', error: null, message: null }, // last write (assign package, save user, ...)
  },
  reducers: {
    clearStaffAction(state) {
      state.action = { status: 'idle', error: null, message: null };
    },
  },
  extraReducers: (builder) => {
    const list = (thunk, key, onOk) => {
      builder
        .addCase(thunk.pending, (s) => { s[key].status = 'loading'; s[key].error = null; })
        .addCase(thunk.fulfilled, (s, { payload }) => { s[key].status = 'ready'; onOk(s[key], payload); })
        .addCase(thunk.rejected, (s, { payload }) => { s[key].status = 'failed'; s[key].error = payload; });
    };
    list(fetchStats, 'stats', (st, p) => { st.data = p; });
    list(fetchCustomers, 'customers', (st, p) => Object.assign(st, p));
    list(fetchCustomerDetail, 'detail', (st, p) => { st.data = p; });
    list(fetchStaffAppointments, 'appointments', (st, p) => { st.items = p.items; if (p.callWindow) st.callWindow = p.callWindow; });
    list(fetchStaffUsers, 'users', (st, p) => { st.items = p.items; });
    list(fetchSettings, 'settings', (st, p) => { st.data = p; });
    list(fetchAdminCatalog, 'catalog', (st, p) => Object.assign(st, p));
    builder.addCase(fetchDietitians.fulfilled, (s, { payload }) => { s.dietitians = payload.items; });

    const write = (thunk, okMessage, onOk) => {
      builder
        .addCase(thunk.pending, (s) => { s.action = { status: 'loading', error: null, message: null }; })
        .addCase(thunk.fulfilled, (s, { payload }) => {
          s.action = { status: 'done', error: null, message: okMessage };
          onOk?.(s, payload);
        })
        .addCase(thunk.rejected, (s, { payload }) => { s.action = { status: 'failed', error: payload, message: null }; });
    };
    write(assignPackage, 'Package added to the customer.');
    write(adjustRewards, 'Reward points updated.');
    write(updateStaffAppointment, 'Appointment updated.', (s, p) => {
      const i = s.appointments.items.findIndex((a) => a._id === p.appointment._id);
      if (i >= 0) s.appointments.items[i] = { ...s.appointments.items[i], ...p.appointment, customer: s.appointments.items[i].customer, dietitian: s.dietitians.find((d) => d._id === p.appointment.dietitian) || null };
    });
    write(createStaffUser, 'Staff account created.', (s, p) => { s.users.items.push(p.user); });
    write(updateStaffUser, 'Staff account updated.', (s, p) => {
      const i = s.users.items.findIndex((u) => u._id === p.user._id);
      if (i >= 0) s.users.items[i] = p.user;
    });
    write(saveSettings, 'Settings saved.', (s, p) => { s.settings.data = { ...s.settings.data, [p.key]: p[p.key] }; });
    write(saveCatalogItem, 'Saved.', (s, { kind, item }) => {
      const arr = s.catalog[kind];
      const i = arr.findIndex((x) => x._id === item._id);
      if (i >= 0) arr[i] = item; else arr.push(item);
    });
  },
});

export const { clearStaffAction } = staffSlice.actions;
export default staffSlice.reducer;
export const selectStaff = (s) => s.staff;
