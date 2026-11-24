export function configuredCheckInGrace(rawValue) {
  const value = Number(rawValue ?? 10);
  return Number.isFinite(value) && value >= 0 && value <= 60 ? value : 10;
}

export function checkInDecision(booking, now) {
  if (booking.status !== "confirmed") return "inactive";
  if (booking.checkedInAt) return "already_checked_in";
  if (now < booking.startAt) return "too_early";
  if (now > booking.checkInDeadline) return "deadline_passed";
  return null;
}
