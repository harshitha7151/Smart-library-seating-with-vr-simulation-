// SeatPanel.jsx — selection info panel shown when a seat is chosen

import "./SeatPanel.css";
import { STATUS } from "./floorData";

export default function SeatPanel({ selectedSeat, floor, seatState, onClear }) {
  if (!selectedSeat) return null;

  // Parse seat ID: e.g. "T6-S3" → table="T6", seat="S3"
  // or "F4-T1-S2" → table="F4-T1", seat="S2"
  const parts = selectedSeat.split("-");
  const seatNum = parts[parts.length - 1];           // last segment: S3
  const tableId = parts.slice(0, -1).join("-");      // everything before last: T6 or F4-T1

  const status = seatState[selectedSeat] || STATUS.AVAILABLE;

  return (
    <div className="seat-panel" role="region" aria-label="Selected seat details">
      <div className="seat-panel-header">
        <span className="seat-panel-badge">YOUR SELECTION</span>
        <button className="seat-panel-close" onClick={onClear} aria-label="Clear selection">✕</button>
      </div>

      <div className="seat-panel-body">
        <div className="seat-panel-row">
          <span className="seat-panel-label">Floor</span>
          <span className="seat-panel-value">{floor}</span>
        </div>
        <div className="seat-panel-row">
          <span className="seat-panel-label">Table</span>
          <span className="seat-panel-value">{tableId}</span>
        </div>
        <div className="seat-panel-row">
          <span className="seat-panel-label">Seat</span>
          <span className="seat-panel-value">{seatNum}</span>
        </div>
        <div className="seat-panel-row">
          <span className="seat-panel-label">Status</span>
          <span className={`seat-panel-status status-${status}`}>
            {status === STATUS.AVAILABLE ? "✅ Available" :
             status === STATUS.BOOKED    ? "❌ Booked"   :
                                           "🔵 Selected"}
          </span>
        </div>
      </div>

      <div className="seat-panel-actions">
        <button className="panel-btn-clear" onClick={onClear}>
          Clear Selection
        </button>
        {status === STATUS.AVAILABLE && (
          <button className="panel-btn-book" onClick={() => alert(`Booking is not yet implemented.\n\nSeat ${selectedSeat} noted for the next phase.`)}>
            Book This Seat
          </button>
        )}
      </div>

      <p className="seat-panel-note">
        ⚠️ Sample data only — bookings are not saved or shared between users yet.
      </p>

      {/* Navigation destination hint */}
      <div className="seat-panel-nav-hint">
        📍 <strong>{selectedSeat}</strong> is marked as your destination.
        Route guidance will be available in a future update.
      </div>
    </div>
  );
}
