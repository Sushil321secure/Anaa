import { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import Logo from '../components/Logo.jsx';
import { homeFor, selectAuthInitializing, selectUser } from '../features/auth/authSlice.js';
import { api } from '../services/api.js';
import { fmtDate, fmtDateTime, fmtTime } from '../utils/format.js';
import { useConsultationCall } from '../webrtc/useConsultationCall.js';
import useDocumentMeta from '../hooks/useDocumentMeta.js';

const clock = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
const dur = (s) => (s >= 60 ? `${Math.floor(s / 60)} min ${s % 60 ? `${s % 60} s` : ''}`.trim() : `${s} s`);
const MEDIA_TEXT = {
  denied: 'Blocked. Allow access in your browser’s address bar, then press Retry.',
  missing: 'No device found.',
  busy: 'In use by another app. Close it and press Retry.',
  error: 'Not available.',
  unknown: 'Checking…',
  ok: 'Working',
};

function VideoTile({ stream, muted, mirror, label, off, offText, className = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.srcObject !== stream) el.srcObject = stream || null;
    if (stream) el.play?.().catch(() => {});
  }, [stream]);
  return (
    <div className={`room-tile ${className}`}>
      <video ref={ref} autoPlay playsInline muted={muted} className={mirror ? 'mirror' : ''} aria-label={label} />
      {(off || !stream) && <div className="room-tile-off"><span className="room-avatar">{(label || '?').charAt(0).toUpperCase()}</span><span>{offText || 'Camera off'}</span></div>}
      <span className="room-label">{label}</span>
    </div>
  );
}

function Pill({ ok, children }) {
  return <li className={`room-check ${ok === true ? 'ok' : ok === false ? 'bad' : ''}`}><span className="dot" />{children}</li>;
}

export default function ConsultationRoom() {
  useDocumentMeta('Online consultation | Anaa Nutricare');
  const { id } = useParams();
  const user = useSelector(selectUser);
  const initializing = useSelector(selectAuthInitializing);
  if (initializing) return <p className="center-note">Loading…</p>;
  if (!user) return <Navigate to="/login" replace state={{ from: `/consultation/${id}` }} />;
  return <Room id={id} user={user} />;
}

function Room({ id, user }) {
  const navigate = useNavigate();
  const call = useConsultationCall(id);
  const { info, phase, error, notice, localStream, remoteStream, mediaStatus, micOn, camOn, peerMedia, peerName, quality, seconds, finalSeconds } = call;
  const stageRef = useRef(null);
  const [full, setFull] = useState(false);
  const [done, setDone] = useState({ status: 'idle', message: null });
  const home = homeFor(user);
  const isDiet = info?.role === 'DIETITIAN';
  const other = info ? (isDiet ? 'customer' : 'dietitian') : 'participant';
  const otherName = peerName || info?.peer?.name || null;
  const inCall = ['joining', 'waiting', 'connecting', 'connected', 'reconnecting', 'failed'].includes(phase);

  useEffect(() => {
    const on = () => setFull(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);
  const toggleFull = () => { if (document.fullscreenElement) document.exitFullscreen(); else stageRef.current?.requestFullscreen?.().catch(() => {}); };

  async function markCompleted() {
    setDone({ status: 'loading', message: null });
    try {
      await api(`/staff/appointments/${id}`, { method: 'PATCH', body: { status: 'COMPLETED' } });
      setDone({ status: 'done', message: 'The consultation is marked as completed.' });
    } catch (e) {
      setDone({ status: 'failed', message: e.message });
    }
  }

  const mediaBad = ['denied', 'missing', 'busy', 'error'];
  const camBad = mediaBad.includes(mediaStatus.camera);
  const micBad = mediaBad.includes(mediaStatus.microphone);
  const noMedia = !localStream && (camBad || micBad);

  return (
    <div className="room" data-phase={phase}>
      <header className="room-top">
        <Link to={home} className="room-brand" aria-label="Back to dashboard"><Logo className="room-logo" /></Link>
        <div className="room-title">
          <strong>Online consultation</strong>
          {info && <span>{fmtDate(info.appointment.startsAt)} · {fmtTime(info.appointment.startsAt)} IST · {info.appointment.durationMinutes} min</span>}
        </div>
        <span className={`room-state s-${phase}`} role="status">{{ loading: 'Loading', lobby: 'Not joined', joining: 'Joining…', waiting: 'Waiting', connecting: 'Connecting…', connected: 'Connected', reconnecting: 'Reconnecting…', failed: 'Connection failed', ended: 'Ended', error: 'Unavailable' }[phase]}</span>
      </header>

      {phase === 'loading' && <main className="room-main"><p className="room-msg">Loading your consultation…</p></main>}

      {phase === 'error' && (
        <main className="room-main">
          <section className="room-card narrow">
            <h1>We couldn’t open this consultation</h1>
            <p>{error}</p>
            <Link className="btn btn-primary" to={home}>Return to dashboard</Link>
          </section>
        </main>
      )}

      {phase === 'lobby' && info && (
        <main className="room-main lobby">
          <section className="room-card preview">
            <VideoTile stream={localStream} muted mirror label="You" off={!camOn || camBad} offText={camBad ? 'Camera unavailable' : 'Camera off'} />
            <ul className="room-checks" aria-label="Device check">
              <Pill ok={mediaStatus.camera === 'ok' ? true : camBad ? false : undefined}>Camera: {MEDIA_TEXT[mediaStatus.camera]}</Pill>
              <Pill ok={mediaStatus.microphone === 'ok' ? true : micBad ? false : undefined}>Microphone: {MEDIA_TEXT[mediaStatus.microphone]}</Pill>
            </ul>
            {(camBad || micBad) && <button type="button" className="btn btn-outline btn-sm" onClick={call.retryMedia}>Retry camera and microphone</button>}
            {camBad && !micBad && localStream && <p className="room-hint">You can still join with audio only.</p>}
          </section>
          <section className="room-card details">
            <h1>Your consultation with {otherName || `your ${other}`}</h1>
            <dl className="room-dl">
              <div><dt>{isDiet ? 'Customer' : 'Dietitian'}</dt><dd>{otherName || '—'}</dd></div>
              <div><dt>Date and time</dt><dd>{fmtDateTime(info.appointment.startsAt)} IST</dd></div>
              <div><dt>Duration</dt><dd>{info.appointment.durationMinutes} minutes</dd></div>
              <div><dt>Status</dt><dd>{info.appointment.status === 'IN_PROGRESS' ? 'In progress' : 'Confirmed'}</dd></div>
            </dl>
            <ul className="room-tips">
              <li>Join from a quiet, well-lit place on a stable connection.</li>
              <li>Allow camera and microphone when your browser asks.</li>
              <li>Headphones help avoid echo.</li>
            </ul>
            {error && <p className="room-error" role="alert">{error}</p>}
            {!info.canJoin && <p className="room-notice" role="status">{info.message}{info.reason === 'TOO_EARLY' && ` It opens at ${fmtTime(info.window.opensAt)} IST and this page will unlock automatically.`}</p>}
            <div className="room-actions">
              <button type="button" className="btn btn-primary" disabled={!info.canJoin || noMedia} onClick={call.join}><Icon name="video" size={18} /> Join consultation</button>
              <Link to={home} className="btn btn-outline">Back to dashboard</Link>
            </div>
            {noMedia && info.canJoin && <p className="room-hint">Fix the camera or microphone access above to join.</p>}
          </section>
        </main>
      )}

      {inCall && (
        <main className="room-main call">
          <div className={`room-stage ${full ? 'is-full' : ''}`} ref={stageRef}>
            {phase === 'connected' || (phase === 'reconnecting' && remoteStream) ? (
              <>
                <VideoTile stream={remoteStream} label={otherName || other} off={!peerMedia.video} offText="Camera off" className="remote" />
                {!peerMedia.audio && <span className="room-muted-badge">Microphone off</span>}
              </>
            ) : (
              <div className="room-waiting" role="status">
                {(phase === 'waiting' || phase === 'joining') && <div className="pulse" aria-hidden="true" />}
                {(phase === 'connecting' || (phase === 'reconnecting' && !remoteStream)) && <div className="spinner" aria-hidden="true" />}
                <h2>
                  {phase === 'joining' && 'Joining the consultation…'}
                  {phase === 'waiting' && `Waiting for the ${other} to join`}
                  {phase === 'connecting' && `${otherName || `The ${other}`} is joining…`}
                  {phase === 'reconnecting' && 'Reconnecting…'}
                  {phase === 'failed' && 'We couldn’t connect the video call'}
                </h2>
                <p>
                  {phase === 'waiting' && `${info?.peer?.name ? `${otherName} has` : `The ${other} has`} not entered the room yet. Your camera preview is on, and you can test your microphone and camera while you wait.`}
                  {phase === 'connecting' && 'Setting up a secure direct connection. This usually takes a few seconds.'}
                  {phase === 'reconnecting' && 'The connection was interrupted. We are trying to restore it.'}
                  {phase === 'failed' && 'Your network may be blocking a direct video connection (some office, school or mobile networks do). Try again, switch networks, or use another device.'}
                </p>
                {phase === 'failed' && <div className="room-actions"><button type="button" className="btn btn-primary" onClick={call.retryConnection}>Try again</button></div>}
                <ul className="room-checks centered">
                  <Pill ok>You are in the room{isDiet ? ' (Dietitian)' : ''}</Pill>
                  <Pill ok={phase === 'connecting' ? true : undefined}>{otherName || `The ${other}`}: {phase === 'connecting' ? 'joining' : 'not in the room'}</Pill>
                </ul>
              </div>
            )}
            {localStream && (
              <VideoTile stream={localStream} muted mirror label="You" off={!camOn || !localStream.getVideoTracks().length} offText={localStream.getVideoTracks().length ? 'Camera off' : 'Audio only'} className={`local ${phase === 'connected' || remoteStream ? 'pip' : 'big'}`} />
            )}
            {notice && <p className="room-banner" role="status">{notice}</p>}
            {phase === 'connected' && (
              <div className="room-hud">
                <span className="hud-time"><span className="rec" aria-hidden="true" />{clock(seconds)}</span>
                {quality && <span className={`hud-q q-${quality}`} title="Connection quality"><span className="bars"><i /><i /><i /></span>{{ good: 'Good', fair: 'Fair', poor: 'Poor' }[quality]} connection</span>}
              </div>
            )}
          </div>
          <div className="room-controls" role="toolbar" aria-label="Call controls">
            <button type="button" className={`rc ${micOn ? '' : 'off'}`} onClick={call.toggleMic} aria-pressed={!micOn} aria-label={micOn ? 'Mute microphone' : 'Unmute microphone'} title={micOn ? 'Mute microphone' : 'Unmute microphone'}><Icon name="mic" size={22} /></button>
            <button type="button" className={`rc ${camOn ? '' : 'off'}`} onClick={call.toggleCam} disabled={!localStream?.getVideoTracks().length} aria-pressed={!camOn} aria-label={camOn ? 'Turn camera off' : 'Turn camera on'} title={camOn ? 'Turn camera off' : 'Turn camera on'}><Icon name="video" size={22} /></button>
            {call.canSwitchCamera && <button type="button" className="rc" onClick={call.switchCamera} aria-label="Switch camera" title="Switch camera"><Icon name="flip" size={22} /></button>}
            <button type="button" className="rc" onClick={toggleFull} aria-label={full ? 'Exit full screen' : 'Full screen'} title={full ? 'Exit full screen' : 'Full screen'}><Icon name={full ? 'shrink' : 'expand'} size={22} /></button>
            <button type="button" className="rc end" onClick={call.leave} aria-label="End consultation" title="End consultation"><Icon name="phone" size={22} /><span>End</span></button>
          </div>
        </main>
      )}

      {phase === 'ended' && (
        <main className="room-main">
          <section className="room-card narrow">
            <div className="room-done-icon"><Icon name="check" size={30} /></div>
            <h1>{finalSeconds > 0 ? 'Consultation ended' : 'You left the consultation'}</h1>
            {notice && <p>{notice}</p>}
            <dl className="room-dl">
              {finalSeconds > 0 && <div><dt>Time connected</dt><dd>{dur(finalSeconds)}</dd></div>}
              {info && <div><dt>Appointment</dt><dd>{fmtDateTime(info.appointment.startsAt)} IST · {info.appointment.durationMinutes} min</dd></div>}
              {otherName && <div><dt>{isDiet ? 'Customer' : 'Dietitian'}</dt><dd>{otherName}</dd></div>}
            </dl>
            {isDiet ? (
              <>
                <p>Mark the consultation completed once you have finished. Leaving the call does not complete it automatically.</p>
                {done.message && <p className={done.status === 'failed' ? 'room-error' : 'room-notice'} role="status">{done.message}</p>}
                {done.status !== 'done' && <button type="button" className="btn btn-primary" onClick={markCompleted} disabled={done.status === 'loading'}>Mark consultation completed</button>}
              </>
            ) : (
              <>
                <h2>Next steps</h2>
                <ul className="room-tips">
                  <li>Your dietitian will mark the consultation complete and can publish your diet plan.</li>
                  <li>Published plans appear under <Link to="/portal/diet-plans">Diet plans</Link>.</li>
                  <li>Left by mistake? You can rejoin while the room is still open.</li>
                </ul>
              </>
            )}
            <div className="room-actions">
              <button type="button" className="btn btn-outline" onClick={() => navigate(0)}>Rejoin</button>
              <Link to={home} className="btn btn-primary">Return to dashboard</Link>
            </div>
          </section>
        </main>
      )}
    </div>
  );
}
