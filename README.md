# Anaa Nutricare

Two independent apps (JavaScript only, Node 22), three portals:

| Portal | Who | Where |
|---|---|---|
| Public website | everyone | `/` (home, programmes, packages, contact, testimonials, discovery call) |
| Customer portal | signed-in customers | `/portal` |
| Admin portal | owner, admin, dietitian, operations | `/admin` |

```
client/   React + Vite + React Router + Redux Toolkit   (port 5173, proxies /api to the server)
  src/app/        routes + role-based navigation
  src/layouts/    PublicLayout, PortalLayout (responsive sidebar / mobile drawer)
  src/features/   Redux slices: auth, account, appointments, progress, dietplans, rewards, staff, ...
  src/components/ shared UI (ui.jsx, Slider, LineChart, PasswordField, AuthShell, ...)
  src/pages/      route pages
  src/services/   API client (JSON, file upload, protected download)
server/   Express + Mongoose + Socket.IO                 (port 4000)
  src/modules/    auth, users, catalog, enquiries, purchases, appointments, dietplans,
                  progress, rewards, testimonials, settings, staff, mail, audit
  src/seeds/      dev-only demo data
  tests/          node:test (unit tests + integration tests against a real MongoDB)
images/   original assets from the old site (contains malware files; never serve or commit)
```

## Run locally
```
cd server
copy .env.example .env      # then set MONGO_URI and a long random JWT_SECRET
npm install
npm run seed                # demo users, packages, testimonials and demo customer data
npm run dev                 # API on http://localhost:4000

cd client
npm install
npm run dev                 # website on http://localhost:5173
```
`MONGO_URI` for a local MongoDB (the one Compass connects to) is `mongodb://127.0.0.1:27017/anaa_nutricare`.
The seed is safe to re-run: it rebuilds the demo customer's package, check-ins and appointment each time.

Demo accounts (development only, password `Demo@12345`): `owner@`, `admin@`, `dietitian@`, `ops@`, `customer@` + `anaa.test`.
The login page shows buttons that fill these in when running `npm run dev`.

## Tests
```
cd server && npm test
```
Runs 30 tests. The integration tests use a throwaway `anaa_test` database on the same MongoDB (wiped on every run) and are skipped
if MongoDB is not reachable. They cover sign-up/login/reset, roles, packages and booking (including two people booking the same slot
at once), diet plan upload and private download, progress, referrals and rewards, staff rules and settings.

## What each portal does

**Customer** — dashboard (consultations left, next appointment, weight trend), appointments (pick a day and a free time, cancel with
a clear rule about returning the consultation), my packages (entitlements and expiry), diet plans (private download), progress
(weight / waist / body fat / BMI chart), refer and earn (code, link, points history), profile and password.

**Admin (by role)**
- Owner / Admin: overview with revenue, enquiries, customers (profile, packages, appointments, diet plans, progress), record a payment
  made by cash/UPI/bank transfer, appointments, packages and services (prices, durations, benefits, consultations), testimonials,
  staff accounts, settings (booking hours, cancellation window, referral reward rules).
- Dietitian: customers (read, diet plans, progress) and their appointments.
- Operations: enquiries, customers, appointments, recording payments.

## Rules worth knowing
- Prices are stored in paise and always read from the database; the browser never sends a price.
- A booking uses one consultation from the customer's package. It is taken atomically and given back if the slot was just taken.
  Cancelling earlier than the configured window (default 24 hours) returns it; clinic-side cancellations always return it.
- Times are stored in UTC and shown in IST. Default consultation hours are Mon–Sat 10:00–18:00, 45-minute slots, one booking per
  dietitian per time (editable in Admin → Settings).
- Referral rewards are OFF until the owner sets "points per referral" in Settings. The reward is paid once, when the referred
  friend's first package is paid. Matching phone/email referrals are rejected.
- Diet plan files are stored under `server/storage/` (git-ignored) and can only be downloaded through the authenticated API.
- Without SMTP settings, emails are recorded as SKIPPED in the `emailLogs` collection instead of being sent. In development the
  forgot-password page shows the reset link directly.

## Status
Done: public site, all three portals, auth (register, login, forgot/reset password, change password), appointments with slot booking,
diet plans, progress tracking, referrals and rewards ledger, packages and manual payment recording, catalogue / testimonial / staff /
settings management, role-based access everywhere.

Not done yet:
- **Online payment page** (Razorpay checkout and signature verification are built on the server; keys and the payment page come later).
- **Video consultations (WebRTC)**: needs the existing chat app's WebRTC / Google configuration. Until then, staff can paste a video
  link on each appointment.
- Redeeming reward points at checkout (comes with the payment page), Docker Compose / deployment files, the old-site Gallery, Blog,
  Recipe, Privacy Policy and Terms pages.

See [docs/IMPLEMENTATION_CHECKLIST.md](docs/IMPLEMENTATION_CHECKLIST.md).

## Log & Earn rewards

- Admin: `/admin/rewards` (OWNER/ADMIN) sets rule points, conversion (paise per 100 points), per-order discount cap, minimum redemption, expiry and referral validity. Nothing is awarded until a rule is enabled with points above 0.
- Customer: `/portal/rewards`; public page: `/log-and-earn` (shows live settings only, hidden when the programme is off).
- Expiry and maintenance run hourly in the API process (Asia/Kolkata month boundaries); admins can trigger it from Reports.
- Local testing without Razorpay: `RAZORPAY_MOCK=true` (non-production only). Real keys are still needed for live payments; SMTP must be configured for emails.
- Tests: `cd server && npm test` (see the section above for the current count).

## Online video consultation (one-to-one, WebRTC)
- Room: `/consultation/:appointmentId` (customer and the **assigned** dietitian only). Customer list (`/portal/appointments`) and staff list (`/admin/appointments`) show a countdown and a **Join consultation** button for online appointments.
- Joining window (Settings key `consultationCall`, defaults): opens **10 min** before the start, stays open until the booked end + **15 min** grace. Cancelled, completed, no-show, in-clinic and unassigned appointments cannot be joined. Non-participants get 404.
- Authorisation: `GET /api/consultations/:id` (room details, no side effects) and `POST /api/consultations/:id/token` (a 10-minute token bound to that one appointment, so the WebSocket does not depend on the cross-site cookie). Every `consultation:join` is re-checked against the database.
- Socket.IO events: `consultation:join` (ack) / `participant-joined` / `participant-left` / `waiting` / `offer` / `answer` / `ice-candidate` / `reconnect` / `media-state` / `reject` / `leave` / `ended` / `error`. The server only relays between the two members of `consultation_<appointmentId>`, validates every payload and stores no SDP.
- Signalling roles: whoever is already in the room sends the offer when the other arrives; on an ICE restart the dietitian offers; on a simultaneous offer the customer yields.
- **ICE: Google public STUN only** (`stun:stun.l.google.com:19302`), defined once in `client/src/webrtc/config.js`. No TURN, so a direct connection can fail on some corporate, school, symmetric-NAT or carrier-grade-NAT mobile networks. The UI then shows "couldn't connect" with a retry; the fix would be adding a TURN server in that one config file.
- Lifecycle: the appointment becomes `IN_PROGRESS` when both have been in the room; leaving never completes it. Only the assigned dietitian (or staff) marks it `COMPLETED` (button on the call-ended screen or the Appointments page). `ConsultationSession` keeps join/leave times and connected seconds only (no media, no SDP, no tokens).
- Assigning a dietitian e-mails them (`appointmentAssigned`). The booking confirmation e-mail to the customer already existed.
- Deployment (Vercel + Render): set `VITE_SOCKET_URL=https://<your-render-service>` in the Vercel project (Vercel cannot proxy WebSockets), `CLIENT_ORIGIN=https://<your-vercel-domain>` and `COOKIE_SECURE=true` on Render, and keep the Render service always on (a sleeping free instance drops calls). Camera and microphone need HTTPS.
- Tests: `cd server && npm test` (67 passing, includes 6 room tests with a real Socket.IO server). Browser end-to-end scripts are not in the repo.
