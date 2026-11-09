// Group yoga (Google Meet) rules. Kept here, separate from the one-to-one consultation settings.
export const YOGA = {
  joinBeforeMinutes: 15, // Join Session unlocks this long before the start...
  joinAfterEndMinutes: 0, // ...and locks again at the scheduled end (+ this grace)
  cancelBeforeHours: 12, // participants can cancel up to this long before the start (proposed policy, pending owner confirmation)
  paymentHoldMinutes: 15, // a seat is held this long while the Razorpay window is open
  maxParticipantsCap: 100, // free Google Meet allows up to 100 participants
  freeMeetMaxMinutes: 60, // free Google Meet ends group calls (3+ people) after 60 minutes
  categories: ['Hatha', 'Vinyasa', 'Ashtanga', 'Yin', 'Restorative', 'Prenatal', 'Pranayama & Meditation', 'Therapeutic', 'Other'],
  levels: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'ALL_LEVELS'],
  statuses: ['draft', 'awaiting_meeting_link', 'scheduled', 'ongoing', 'completed', 'cancelled'],
};
