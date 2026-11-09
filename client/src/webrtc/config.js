// The one place that defines how both people connect. Caller and receiver always build their RTCPeerConnection from this.
// Google's public STUN server needs no key, account or payment. STUN only helps two browsers find each other through
// ordinary NATs: on some corporate / symmetric-NAT / mobile-carrier networks a direct connection is impossible without a
// TURN relay, which is deliberately not part of this version (see docs).
export const rtcConfiguration = {
  iceServers: [
    {
      urls: 'stun:stun.l.google.com:19302',
    },
  ],
};

// Socket.IO endpoint. Empty = same origin (Vite dev proxy or a reverse proxy). On Vercel the API is on another origin and
// Vercel cannot proxy WebSockets, so set VITE_SOCKET_URL to the Render backend URL (for example https://anaa-api.onrender.com).
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || undefined;

// Safe diagnostics: connection states and counts only. Never tokens, names, e-mails, SDP text or health information.
export const dlog = (...args) => console.info('[consult]', ...args);
