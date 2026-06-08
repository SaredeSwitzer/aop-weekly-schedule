"use client";

import { fmtTimeRange, locColorClass, timeToMin, START_HOUR, HOUR_PX } from "@/lib/dates";
import type { Class, SignupMap } from "@/lib/types";

type Props = {
  cls: Class;
  signups: SignupMap;
  onClick: (id: string) => void;
};

export default function ClassBlock({ cls, signups, onClick }: Props) {
  const taken = signups[cls.id]?.length ?? 0;
  const full = taken >= cls.capacity;
  const low = !full && cls.capacity - taken <= 3;
  const spotsText = full ? "Full" : low ? `${cls.capacity - taken} left` : `${cls.capacity - taken} open`;

  const startMin = timeToMin(cls.time) - START_HOUR * 60;
  const endMin = cls.end_time
    ? timeToMin(cls.end_time) - START_HOUR * 60
    : startMin + 60;
  const top = Math.max(0, (startMin / 60) * HOUR_PX);
  const height = Math.max(24, ((endMin - startMin) / 60) * HOUR_PX - 4);

  const colorClass = locColorClass(cls.location, full);

  return (
    <button
      className={`class-block ${colorClass}`}
      style={{ top, height }}
      onClick={() => onClick(cls.id)}
      aria-label={`${cls.class_name} at ${fmtTimeRange(cls.time, cls.end_time)}`}
    >
      <div className="cb-time">{fmtTimeRange(cls.time, cls.end_time)}</div>
      <div className="cb-name">{cls.class_name}</div>
      {cls.location && height > 38 && (
        <div className="cb-loc">📍 {cls.location}</div>
      )}
      {height > 50 && (
        <div className="cb-spots">{spotsText} · 👥 {taken}</div>
      )}
    </button>
  );
}
