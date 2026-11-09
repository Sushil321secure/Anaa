import { Badge } from '../../components/ui.jsx';
import { BOOKING_LABEL, BOOKING_TONE, LEVEL_LABEL, SESSION_LABEL, SESSION_TONE, localTime, originalTime, sameZone } from './yogaUtils.js';

export const SessionBadge = ({ status }) => <Badge tone={SESSION_TONE[status] || 'neutral'}>{SESSION_LABEL[status] || status}</Badge>;
export const BookingBadge = ({ status }) => <Badge tone={BOOKING_TONE[status] || 'neutral'}>{BOOKING_LABEL[status] || status}</Badge>;
export const level = (l) => LEVEL_LABEL[l] || l;

// Your local time first, the session's own timezone underneath.
export function Times({ session }) {
  return (
    <>
      <strong>{localTime(session.startsAt)}</strong>
      {!sameZone(session.timezone) && <><br /><small className="muted">{originalTime(session.startsAt, session.timezone)}</small></>}
    </>
  );
}
