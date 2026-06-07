"use client";

import { getWeekDates, getWeekKey, fmtDate } from "@/lib/dates";

type Props = {
  weekKey: string;
  onChange: (key: string) => void;
};

export default function WeekNav({ weekKey, onChange }: Props) {
  const dates = getWeekDates(weekKey);
  const todayKey = getWeekKey(new Date());
  const isThisWeek = weekKey === todayKey;

  function shift(dir: number) {
    const [y, m, d] = weekKey.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + dir * 7);
    onChange(getWeekKey(dt));
  }

  return (
    <div className="week-nav">
      <button className="nav-btn" onClick={() => shift(-1)}>← Prev</button>
      <div className="week-label">
        {fmtDate(dates[0])} — {fmtDate(dates[6])}
        {isThisWeek && <span className="this-week-badge">This Week</span>}
      </div>
      <button className="nav-btn" onClick={() => shift(1)}>Next →</button>
    </div>
  );
}
