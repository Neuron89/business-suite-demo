import type { UnifiDoor, UnifiSchedule, UnifiScheduleSlot } from "../api/types";

const DAY_ORDER: { key: keyof NonNullable<UnifiSchedule["week_schedule"]>; label: string }[] = [
  { key: "monday", label: "Mon" },
  { key: "tuesday", label: "Tue" },
  { key: "wednesday", label: "Wed" },
  { key: "thursday", label: "Thu" },
  { key: "friday", label: "Fri" },
  { key: "saturday", label: "Sat" },
  { key: "sunday", label: "Sun" },
];

function formatSlot(s: UnifiScheduleSlot): string {
  return `${s.start_time}–${s.end_time}`;
}

export function DoorList({ doors }: { doors: UnifiDoor[] }) {
  if (doors.length === 0) {
    return <p className="dash-empty">No doors assigned to this policy.</p>;
  }
  return (
    <table className="mini-table">
      <thead>
        <tr>
          <th>Door</th>
          <th>Location</th>
          <th>Floor</th>
        </tr>
      </thead>
      <tbody>
        {doors.map((d) => (
          <tr key={d.id}>
            <td><strong>{d.name}</strong></td>
            <td>{d.full_name ?? "—"}</td>
            <td>{d.floor ?? "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ScheduleView({ schedule }: { schedule: UnifiSchedule | null }) {
  if (!schedule) {
    return <p className="dash-empty">No schedule attached (24/7 access).</p>;
  }
  const week = schedule.week_schedule;
  return (
    <div className="schedule-view">
      <div className="schedule-view__header">
        <strong>{schedule.name}</strong>
        {schedule.type ? (
          <span className="schedule-view__type">{schedule.type}</span>
        ) : null}
      </div>
      {!week ? (
        <p className="dash-empty">No weekly time slots defined.</p>
      ) : (
        <table className="mini-table">
          <thead>
            <tr>
              <th>Day</th>
              <th>Time slots</th>
            </tr>
          </thead>
          <tbody>
            {DAY_ORDER.map(({ key, label }) => {
              const slots = week[key] ?? [];
              return (
                <tr key={key}>
                  <td><strong>{label}</strong></td>
                  <td>
                    {slots.length === 0 ? (
                      <span className="user-list__muted">—</span>
                    ) : (
                      slots.map(formatSlot).join(", ")
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
