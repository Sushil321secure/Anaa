import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { api } from '../services/api.js';
import { SOCKET_URL, dlog, rtcConfiguration } from './config.js';

// One-to-one consultation call. Roles: the person already in the room sends the offer when the other arrives; for a later
// ICE restart the dietitian always offers; on a simultaneous offer the customer is the "polite" side and yields.
// Phases: loading | lobby | joining | waiting | connecting | connected | reconnecting | failed | ended | error

const CONNECT_TIMEOUT_MS = 25000;
const MAX_RESTARTS = 3;
const classify = (err) => (['NotAllowedError', 'SecurityError', 'PermissionDeniedError'].includes(err?.name) ? 'denied'
  : ['NotFoundError', 'OverconstrainedError', 'DevicesNotFoundError'].includes(err?.name) ? 'missing'
  : err?.name === 'NotReadableError' ? 'busy' : 'error');

export function useConsultationCall(appointmentId) {
  const [info, setInfo] = useState(null);
  const [phase, setPhase] = useState('loading');
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [mediaStatus, setMediaStatus] = useState({ camera: 'unknown', microphone: 'unknown' });
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [peerMedia, setPeerMedia] = useState({ audio: true, video: true });
  const [peerName, setPeerName] = useState(null);
  const [quality, setQuality] = useState(null);
  const [seconds, setSeconds] = useState(0);
  const [finalSeconds, setFinalSeconds] = useState(0);
  const [canSwitchCamera, setCanSwitchCamera] = useState(false);

  const r = useRef({ restarts: 0, pending: [], making: false, role: null, token: null, wantsIn: false, facing: 'user' });
  const socketRef = useRef(null);
  const pcRef = useRef(null);
  const localRef = useRef(null);
  const timers = useRef({});
  const secondsRef = useRef(0);
  const mounted = useRef(true);
  const acquiring = useRef(null);

  const clearTimer = (k) => { clearTimeout(timers.current[k]); clearInterval(timers.current[k]); delete timers.current[k]; };
  const emit = useCallback((ev, payload) => socketRef.current?.emit(ev, payload, (res) => { if (res && res.ok === false) dlog('signalling rejected', ev, res.code); }), []);

  // ------------------------------------------------------------------ local media
  const doAcquire = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      const e = { camera: 'error', microphone: 'error', message: 'Camera and microphone need a secure (HTTPS) connection and a supported browser.' };
      setMediaStatus(e);
      throw Object.assign(new Error(e.message), { status: e });
    }
    const gum = (c) => navigator.mediaDevices.getUserMedia(c);
    const status = { camera: 'unknown', microphone: 'unknown' };
    let stream = null;
    try {
      stream = await gum({ audio: { echoCancellation: true, noiseSuppression: true }, video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } });
      status.camera = 'ok';
      status.microphone = 'ok';
    } catch (err) {
      dlog('getUserMedia (audio+video) failed:', err.name);
      const tracks = [];
      try { tracks.push(...(await gum({ audio: true })).getTracks()); status.microphone = 'ok'; } catch (e) { status.microphone = classify(e); dlog('getUserMedia (audio) failed:', e.name); }
      try { tracks.push(...(await gum({ video: true })).getTracks()); status.camera = 'ok'; } catch (e) { status.camera = classify(e); dlog('getUserMedia (video) failed:', e.name); }
      if (tracks.length) stream = new MediaStream(tracks);
    }
    if (stream && !mounted.current) { stream.getTracks().forEach((t) => t.stop()); throw new Error('closed'); }
    setMediaStatus(status);
    if (!stream) throw Object.assign(new Error('Could not use your camera or microphone.'), { status });
    localRef.current = stream;
    setLocalStream(stream);
    setMicOn(stream.getAudioTracks().length > 0);
    setCamOn(stream.getVideoTracks().length > 0);
    navigator.mediaDevices.enumerateDevices().then((d) => setCanSwitchCamera(d.filter((x) => x.kind === 'videoinput').length > 1)).catch(() => {});
    dlog('local media ready', { audio: stream.getAudioTracks().length, video: stream.getVideoTracks().length });
    return stream;
  }, []);

  // One request at a time: overlapping getUserMedia calls make the second fail with "device busy / not found".
  const acquireMedia = useCallback(() => {
    if (localRef.current?.getTracks().some((t) => t.readyState === 'live')) return Promise.resolve(localRef.current);
    acquiring.current ??= doAcquire().finally(() => { acquiring.current = null; });
    return acquiring.current;
  }, [doAcquire]);

  // ------------------------------------------------------------------ peer connection
  const closePc = useCallback(() => {
    clearTimer('stats');
    const pc = pcRef.current;
    if (pc) {
      pc.ontrack = null; pc.onicecandidate = null; pc.onconnectionstatechange = null; pc.oniceconnectionstatechange = null;
      pc.onsignalingstatechange = null; pc.onicegatheringstatechange = null;
      try { pc.close(); } catch { /* already closed */ }
    }
    pcRef.current = null;
    r.current.pending = [];
    setRemoteStream(null);
  }, []);

  const startStats = useCallback((pc) => {
    clearTimer('stats');
    let last = null;
    let logged = false;
    timers.current.stats = setInterval(async () => {
      try {
        const stats = await pc.getStats();
        let rtt = null; let recv = 0; let lost = 0; let pair = null;
        stats.forEach((s) => {
          if (s.type === 'candidate-pair' && s.nominated && s.state === 'succeeded') { pair = s; rtt = s.currentRoundTripTime ?? rtt; }
          if (s.type === 'inbound-rtp' && s.kind === 'video') { recv += s.packetsReceived || 0; lost += s.packetsLost || 0; }
        });
        if (pair && !logged) {
          logged = true;
          const local = stats.get(pair.localCandidateId);
          const remote = stats.get(pair.remoteCandidateId);
          dlog('selected candidate pair', { local: local?.candidateType, remote: remote?.candidateType, protocol: local?.protocol });
        }
        const dRecv = last ? recv - last.recv : 0;
        const dLost = last ? lost - last.lost : 0;
        last = { recv, lost };
        const loss = dRecv + dLost > 20 ? dLost / (dRecv + dLost) : 0;
        if (rtt == null && !dRecv) return;
        setQuality(rtt > 0.4 || loss > 0.08 ? 'poor' : rtt > 0.2 || loss > 0.03 ? 'fair' : 'good');
      } catch { /* stats are best effort */ }
    }, 3000);
  }, []);

  const requestRestart = useCallback(() => {
    if (!r.current.wantsIn) return;
    if (r.current.restarts >= MAX_RESTARTS) {
      setPhase('failed');
      return;
    }
    r.current.restarts += 1;
    dlog('restart requested, attempt', r.current.restarts);
    setPhase('reconnecting');
    // eslint-disable-next-line no-use-before-define
    if (r.current.role === 'DIETITIAN') makeOffer(true); else emit('consultation:reconnect', {});
  }, [emit]); // eslint-disable-line react-hooks/exhaustive-deps

  const armConnectTimeout = useCallback(() => {
    clearTimer('connect');
    timers.current.connect = setTimeout(() => {
      dlog('connect timeout');
      if (pcRef.current?.connectionState !== 'connected') requestRestart();
    }, CONNECT_TIMEOUT_MS);
  }, [requestRestart]);

  const buildPc = useCallback(() => {
    closePc();
    const pc = new RTCPeerConnection(rtcConfiguration);
    pcRef.current = pc;
    const local = localRef.current;
    local.getTracks().forEach((t) => pc.addTrack(t, local));
    if (!local.getVideoTracks().length) pc.addTransceiver('video', { direction: 'recvonly' });
    if (!local.getAudioTracks().length) pc.addTransceiver('audio', { direction: 'recvonly' });
    const remote = new MediaStream();
    pc.ontrack = (e) => {
      dlog('ontrack', e.track.kind);
      remote.addTrack(e.track);
      setRemoteStream(remote);
    };
    pc.onicecandidate = (e) => {
      if (e.candidate) { dlog('onicecandidate', e.candidate.type || 'candidate'); emit('consultation:ice-candidate', { candidate: e.candidate.toJSON() }); } else dlog('onicecandidate: end of candidates');
    };
    pc.onsignalingstatechange = () => dlog('signalingState', pc.signalingState);
    pc.onicegatheringstatechange = () => dlog('iceGatheringState', pc.iceGatheringState);
    pc.oniceconnectionstatechange = () => dlog('iceConnectionState', pc.iceConnectionState);
    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      dlog('connectionState', s);
      if (pcRef.current !== pc) return;
      if (s === 'connected') {
        clearTimer('connect'); clearTimer('disconnected');
        r.current.restarts = 0;
        setNotice(null);
        setPhase('connected');
        startStats(pc);
      } else if (s === 'disconnected') {
        setPhase('reconnecting');
        clearTimer('disconnected');
        timers.current.disconnected = setTimeout(() => { if (pcRef.current === pc && pc.connectionState !== 'connected') requestRestart(); }, 6000);
      } else if (s === 'failed') {
        requestRestart();
      }
    };
    return pc;
  }, [closePc, emit, requestRestart, startStats]);

  const drainCandidates = useCallback(async (pc) => {
    const queued = r.current.pending.splice(0);
    for (const c of queued) {
      try { await pc.addIceCandidate(c); } catch (err) { dlog('addIceCandidate (queued) failed:', err.name); }
    }
    if (queued.length) dlog('applied queued candidates', queued.length);
  }, []);

  const makeOffer = useCallback(async (restart = false) => {
    if (!localRef.current) return;
    let pc = pcRef.current;
    if (!pc || !restart || pc.signalingState === 'closed') pc = buildPc();
    try {
      r.current.making = true;
      const offer = await pc.createOffer(restart ? { iceRestart: true } : undefined);
      await pc.setLocalDescription(offer);
      emit('consultation:offer', { description: { type: pc.localDescription.type, sdp: pc.localDescription.sdp }, restart });
      armConnectTimeout();
    } catch (err) {
      dlog('offer failed:', err.name);
      setError('Could not start the call. Please retry.');
      setPhase('failed');
    } finally {
      r.current.making = false;
    }
  }, [armConnectTimeout, buildPc, emit]);

  const handleOffer = useCallback(async ({ description, restart }) => {
    if (!localRef.current) return;
    const polite = r.current.role === 'CUSTOMER';
    const collision = r.current.making || (pcRef.current && pcRef.current.signalingState !== 'stable');
    if (collision && !polite) { dlog('ignoring colliding offer'); return; }
    try {
      let pc = pcRef.current;
      if (!pc || !restart || pc.signalingState === 'closed') pc = buildPc();
      await pc.setRemoteDescription(description);
      await drainCandidates(pc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      emit('consultation:answer', { description: { type: pc.localDescription.type, sdp: pc.localDescription.sdp } });
      setPhase((p) => (p === 'connected' ? p : 'connecting'));
      armConnectTimeout();
    } catch (err) {
      dlog('handling offer failed:', err.name);
      requestRestart();
    }
  }, [armConnectTimeout, buildPc, drainCandidates, emit, requestRestart]);

  const handleAnswer = useCallback(async ({ description }) => {
    const pc = pcRef.current;
    if (!pc || pc.signalingState !== 'have-local-offer') { dlog('ignoring unexpected answer'); return; }
    try {
      await pc.setRemoteDescription(description);
      await drainCandidates(pc);
    } catch (err) {
      dlog('setRemoteDescription (answer) failed:', err.name);
      requestRestart();
    }
  }, [drainCandidates, requestRestart]);

  const handleCandidate = useCallback(async ({ candidate }) => {
    if (!candidate || typeof candidate.candidate !== 'string') return;
    const pc = pcRef.current;
    if (!pc || !pc.remoteDescription) { r.current.pending.push(candidate); return; }
    try { await pc.addIceCandidate(candidate); } catch (err) { dlog('addIceCandidate failed:', err.name); }
  }, []);

  // ------------------------------------------------------------------ signalling
  const teardown = useCallback(() => {
    r.current.wantsIn = false;
    Object.keys(timers.current).forEach(clearTimer);
    closePc();
    localRef.current?.getTracks().forEach((t) => t.stop());
    localRef.current = null;
    const s = socketRef.current;
    socketRef.current = null;
    if (s) { s.removeAllListeners(); s.close(); }
  }, [closePc]);

  const finish = useCallback((nextPhase, message) => {
    setFinalSeconds(secondsRef.current);
    teardown();
    setLocalStream(null);
    setNotice(message || null);
    setPhase(nextPhase);
  }, [teardown]);

  const refreshToken = useCallback(async () => {
    const t = await api(`/consultations/${appointmentId}/token`, { method: 'POST' });
    r.current.token = t.token;
    r.current.role = t.role;
    return t;
  }, [appointmentId]);

  const joinRoom = useCallback(() => {
    socketRef.current?.emit('consultation:join', { appointmentId }, (res) => {
      if (!res?.ok) {
        dlog('join refused', res?.code);
        const msg = { TOO_EARLY: 'The consultation room is not open yet.', CLOSED: 'This consultation is closed.', CANCELLED: 'This consultation was cancelled.', NO_DIETITIAN: 'A dietitian has not been assigned yet.' }[res?.code] || res?.message || 'Could not join the consultation.';
        finish('error', msg);
        setError(msg);
        return;
      }
      dlog('joined room', res.role, res.peerPresent ? 'peer present' : 'alone');
      if (res.peerName) setPeerName(res.peerName);
      closePc();
      if (res.peerPresent) { setPhase('connecting'); armConnectTimeout(); } else setPhase('waiting');
    });
  }, [appointmentId, armConnectTimeout, closePc, finish]);

  const join = useCallback(async () => {
    setError(null);
    setNotice(null);
    setPhase('joining');
    try {
      await acquireMedia();
      await refreshToken();
    } catch (err) {
      setError(err.status ? err.message : err.message || 'Could not join.');
      setPhase('lobby');
      return;
    }
    r.current.wantsIn = true;
    r.current.restarts = 0;
    if (socketRef.current) { socketRef.current.removeAllListeners(); socketRef.current.close(); }
    const socket = io(SOCKET_URL, { auth: (cb) => cb({ token: r.current.token }), reconnection: true, reconnectionDelay: 1000, reconnectionDelayMax: 5000 });
    socketRef.current = socket;
    socket.on('connect', () => { dlog('socket connected', socket.io.engine.transport.name); joinRoom(); });
    socket.on('connect_error', async (err) => {
      dlog('socket connect_error', err.message);
      if (err.message === 'unauthorized') {
        try { await refreshToken(); } catch (e) { finish('error', e.message || 'Your session has ended. Please sign in again.'); }
      } else setPhase((p) => (p === 'connected' ? p : 'reconnecting'));
    });
    socket.on('disconnect', (why) => {
      dlog('socket disconnected', why);
      if (why === 'io client disconnect') return;
      setNotice('Connection to the server was lost. Reconnecting…');
      setPhase((p) => (p === 'connected' ? p : 'reconnecting'));
    });
    socket.io.on('reconnect', () => { setNotice(null); });
    socket.on('consultation:waiting', () => { setPhase('waiting'); });
    socket.on('consultation:participant-joined', ({ name }) => {
      dlog('participant joined');
      if (name) setPeerName(name);
      setNotice(null);
      setPhase((p) => (p === 'connected' ? p : 'connecting'));
      r.current.restarts = 0;
      makeOffer(false);
    });
    socket.on('consultation:participant-left', ({ reason }) => {
      dlog('participant left', reason);
      setPeerMedia({ audio: true, video: true });
      if (reason === 'disconnected') {
        setNotice('The other participant lost their connection. Waiting for them to return…');
        setPhase((p) => (p === 'connected' ? 'reconnecting' : 'waiting'));
        if (pcRef.current?.connectionState !== 'connected') closePc();
      } else {
        closePc();
        setNotice('The other participant left the consultation.');
        setPhase('waiting');
      }
    });
    socket.on('consultation:offer', handleOffer);
    socket.on('consultation:answer', handleAnswer);
    socket.on('consultation:ice-candidate', handleCandidate);
    socket.on('consultation:reconnect', () => { if (r.current.role === 'DIETITIAN') makeOffer(true); });
    socket.on('consultation:media-state', (m) => setPeerMedia(m));
    socket.on('consultation:reject', () => { setNotice('The other participant could not join with video. They may need to retry.'); });
    socket.on('consultation:error', (e) => { dlog('server error', e?.code); finish('error', e?.message || 'Consultation error.'); setError(e?.message || 'Consultation error.'); });
    socket.on('consultation:ended', () => finish('ended', 'The consultation time is over.'));
  }, [acquireMedia, closePc, finish, handleAnswer, handleCandidate, handleOffer, joinRoom, makeOffer, refreshToken]);

  const leave = useCallback(() => {
    emit('consultation:leave', {});
    finish('ended');
  }, [emit, finish]);

  const retryConnection = useCallback(() => {
    r.current.restarts = 0;
    setError(null);
    setPhase('connecting');
    if (r.current.role === 'DIETITIAN') makeOffer(true); else emit('consultation:reconnect', {});
    armConnectTimeout();
  }, [armConnectTimeout, emit, makeOffer]);

  // ------------------------------------------------------------------ controls
  const toggleMic = useCallback(() => {
    const tracks = localRef.current?.getAudioTracks() || [];
    if (!tracks.length) return;
    const on = !tracks[0].enabled;
    tracks.forEach((t) => { t.enabled = on; });
    setMicOn(on);
    emit('consultation:media-state', { audio: on, video: Boolean(localRef.current?.getVideoTracks()[0]?.enabled) });
  }, [emit]);
  const toggleCam = useCallback(() => {
    const tracks = localRef.current?.getVideoTracks() || [];
    if (!tracks.length) return;
    const on = !tracks[0].enabled;
    tracks.forEach((t) => { t.enabled = on; });
    setCamOn(on);
    emit('consultation:media-state', { audio: Boolean(localRef.current?.getAudioTracks()[0]?.enabled), video: on });
  }, [emit]);
  const switchCamera = useCallback(async () => {
    const local = localRef.current;
    if (!local) return;
    try {
      const devices = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
      const current = local.getVideoTracks()[0]?.getSettings().deviceId;
      const nextDev = devices.find((d) => d.deviceId !== current) || devices[0];
      const fresh = (await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: nextDev.deviceId } } })).getVideoTracks()[0];
      const old = local.getVideoTracks()[0];
      fresh.enabled = old ? old.enabled : true;
      const sender = pcRef.current?.getSenders().find((s) => s.track?.kind === 'video');
      if (sender) await sender.replaceTrack(fresh);
      if (old) { local.removeTrack(old); old.stop(); }
      local.addTrack(fresh);
      setLocalStream(new MediaStream(local.getTracks())); // new object so the preview re-attaches
      localRef.current = local;
    } catch (err) {
      dlog('switch camera failed:', err.name);
      setNotice('Could not switch the camera.');
    }
  }, []);

  // ------------------------------------------------------------------ lifecycle
  const loadInfo = useCallback(async () => {
    try {
      const data = await api(`/consultations/${appointmentId}`);
      if (!mounted.current) return null;
      setInfo({ ...data, skew: new Date(data.window.serverNow).getTime() - Date.now() });
      setPhase((p) => (p === 'loading' ? 'lobby' : p));
      return data;
    } catch (err) {
      if (!mounted.current) return null;
      setError(err.status === 404 ? 'We could not find this consultation for your account.' : err.message);
      setPhase('error');
      return null;
    }
  }, [appointmentId]);

  useEffect(() => {
    mounted.current = true;
    loadInfo().then((d) => { if (d?.canJoin) acquireMedia().catch(() => {}); });
    return () => { mounted.current = false; if (socketRef.current) socketRef.current.emit('consultation:leave', {}); teardown(); };
  }, [loadInfo, acquireMedia, teardown]);

  // When the room is not open yet, open the join button automatically at the right moment (server clock, not the PC's).
  useEffect(() => {
    if (!info || info.canJoin || info.reason !== 'TOO_EARLY') return undefined;
    const wait = new Date(info.window.opensAt).getTime() - (Date.now() + info.skew) + 500;
    const t = setTimeout(() => loadInfo().then((d) => { if (d?.canJoin) acquireMedia().catch(() => {}); }), Math.min(Math.max(wait, 500), 2 ** 31 - 1));
    return () => clearTimeout(t);
  }, [info, loadInfo, acquireMedia]);

  useEffect(() => {
    if (phase !== 'connected') return undefined;
    const t = setInterval(() => { secondsRef.current += 1; setSeconds(secondsRef.current); }, 1000);
    return () => clearInterval(t);
  }, [phase]);

  useEffect(() => {
    const onUnload = () => { socketRef.current?.close(); };
    window.addEventListener('pagehide', onUnload);
    return () => window.removeEventListener('pagehide', onUnload);
  }, []);

  const retryMedia = useCallback(async () => {
    setError(null);
    try { await acquireMedia(); } catch { /* status is shown */ }
  }, [acquireMedia]);

  return {
    info, phase, error, notice, localStream, remoteStream, mediaStatus, micOn, camOn, peerMedia, peerName, quality, seconds, finalSeconds, canSwitchCamera,
    join, leave, retryMedia, retryConnection, toggleMic, toggleCam, switchCamera, reload: loadInfo,
  };
}
