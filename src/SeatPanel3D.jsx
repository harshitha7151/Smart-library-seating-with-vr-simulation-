import { useState } from "react";
import "./SeatPanel3D.css";
import { STATUS } from "./scene3DData";

function localDateTime(minutesAhead) {
  const date = new Date(Date.now() + minutesAhead * 60_000);
  date.setMinutes(Math.ceil(date.getMinutes() / 30) * 30, 0, 0);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export default function SeatPanel3D({
  selectedSeat, floor, seatState, onClear, onBook, isAuthenticated,
  bookingError, bookingSuccess, onOpenBookings, onAvailabilityRangeChange, availabilityWarning,
}) {
  const [startLocal, setStartLocal] = useState(() => localDateTime(60));
  const [endLocal, setEndLocal] = useState(() => localDateTime(180));
  const [busy, setBusy] = useState(false);

  function updateTime(field, value) {
    const next = { startLocal, endLocal, [field]: value };
    if (field === "startLocal") setStartLocal(value);
    else setEndLocal(value);
    const start = new Date(next.startLocal);
    const end = new Date(next.endLocal);
    if (Number.isFinite(start.getTime()) && Number.isFinite(end.getTime()) && end > start) {
      onAvailabilityRangeChange?.(start.toISOString(), end.toISOString());
    }
  }

  async function submitBooking(event) {
    event.preventDefault();
    if (!selectedSeat) return;
    setBusy(true);
    try { await onBook(selectedSeat, new Date(startLocal).toISOString(), new Date(endLocal).toISOString()); }
    finally { setBusy(false); }
  }

  if (!selectedSeat) {
    return bookingSuccess ? (
      <div className="sp3d sp3d-feedback" role="status">
        <p className="sp3d-success">{bookingSuccess}</p>
        <button className="sp3d-btn-book" onClick={onOpenBookings}>View my bookings</button>
      </div>
    ) : bookingError ? <div className="sp3d sp3d-feedback account-error" role="alert">{bookingError}</div> : null;
  }

  const parts = selectedSeat.split("-");
  const seatNum = parts.at(-1);
  const tableId = parts.slice(0, -1).join("-");
  const status = seatState[selectedSeat] ?? STATUS.UNAVAILABLE;

  return (
    <div className="sp3d" role="region" aria-label="Selected seat details">
      <div className="sp3d-header">
        <span className="sp3d-badge">YOUR SELECTION</span>
        <button className="sp3d-close" onClick={onClear} aria-label="Clear">✕</button>
      </div>
      <div className="sp3d-body">
        {[["Floor", floor], ["Table", tableId], ["Seat", seatNum], ["Status", status === STATUS.AVAILABLE ? "Available" : status === STATUS.BOOKED ? "Reserved · not checked in" : status === STATUS.OCCUPIED ? "Checked in" : status === STATUS.UNAVAILABLE ? "Unavailable" : status === STATUS.UNKNOWN ? "Status unknown" : "Selected"]].map(([label, value]) => (
          <div className="sp3d-row" key={label}>
            <span className="sp3d-label">{label}</span>
            <span className={`sp3d-value ${label === "Status" ? `st-${status}` : ""}`}>{value}</span>
          </div>
        ))}
      </div>

      {status === STATUS.AVAILABLE && (
        <form className="sp3d-booking-form" onSubmit={submitBooking}>
          {availabilityWarning && <p className="sp3d-error" role="status">Availability could not be checked. The booking will be confirmed only if the SeatSpace API accepts it.</p>}
          <label>Start time<input required type="datetime-local" value={startLocal} onChange={(event) => updateTime("startLocal", event.target.value)} /></label>
          <label>End time<input required type="datetime-local" value={endLocal} onChange={(event) => updateTime("endLocal", event.target.value)} /></label>
          {bookingError && <p className="sp3d-error" role="alert">{bookingError}</p>}
          <button className="sp3d-btn-book" disabled={busy}>{busy ? "Booking…" : isAuthenticated ? "Confirm booking" : "Sign in to book"}</button>
        </form>
      )}
      {status !== STATUS.AVAILABLE && (
        <p className="sp3d-error" role="status">
          {status === STATUS.UNKNOWN
            ? "Availability could not be verified. Refresh the map before booking."
            : "This seat is not available for the selected time."}
        </p>
      )}

      <div className="sp3d-actions">
        <button className="sp3d-btn-clear" onClick={onClear}>Clear Selection</button>
      </div>
      <p className="sp3d-note">Availability refreshes for your selected time. A booking is confirmed only after the SeatSpace API accepts it.</p>
      <div className="sp3d-nav">📍 <strong>{selectedSeat}</strong> destination coordinates are ready. Route guidance is not available yet.</div>
    </div>
  );
}
