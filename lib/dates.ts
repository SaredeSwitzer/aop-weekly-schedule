import type { Class, Override, OverrideMap } from "./types";

export const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
export const DISPLAY_ORDER = [6,0,1,2,3,4,5]; // Sun Mon Tue Wed Thu Fri Sat
export const DISPLAY_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
export const START_HOUR = 6;
export const END_HOUR = 21;
export const HOUR_PX = 64;

export function getWeekKey(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

export function getWeekDates(key: string): Date[] {
  const [y, mo, d] = key.split("-").map(Number);
  const sun = new Date(y, mo - 1, d);
  return Array.from({ length: 7 }, (_, i) => {
    const dt = new Date(sun);
    dt.setDate(sun.getDate() + i);
    return dt;
  });
}

export function fmtDate(dt: Date): string {
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function fmtDateLong(dt: Date): string {
  return dt.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

export function fmtTime(t: string | null | undefined): string {
  if (!t) return "";
  const [h, min] = t.split(":").map(Number);
  return `${h % 12 || 12}:${min < 10 ? "0" : ""}${min} ${h >= 12 ? "PM" : "AM"}`;
}

export function fmtTimeRange(s: string | null, e: string | null): string {
  return e ? `${fmtTime(s)} – ${fmtTime(e)}` : fmtTime(s);
}

export function timeToMin(t: string | null | undefined): number {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function getSlotDate(dayIdx: number, weekKey: string): Date {
  const dates = getWeekDates(weekKey);
  const col = DISPLAY_ORDER.indexOf(dayIdx);
  return col >= 0 ? dates[col] : dates[0];
}

export function locColorClass(location: string | null | undefined, full = false): string {
  const suffix = full ? " full" : "";
  if (!location) return `loc-other${suffix}`;
  if (location.includes("Turtle Pond") || location.includes("Central Park")) return `loc-turtle${suffix}`;
  if (location.includes("21 West End")) return `loc-westend${suffix}`;
  if (location.includes("80th")) return `loc-80th${suffix}`;
  return `loc-other${suffix}`;
}

export function getEffectiveClass(cls: Class, overrides: OverrideMap): (Class & { overridden?: boolean; cancelled?: boolean }) | null {
  const ov: Override | undefined = overrides[cls.id];
  if (!ov) return cls;
  if (ov.cancelled) return null;
  return {
    ...cls,
    ...(ov.time && { time: ov.time }),
    ...(ov.end_time && { end_time: ov.end_time }),
    ...(ov.class_name && { class_name: ov.class_name }),
    ...(ov.location !== null && ov.location !== undefined && { location: ov.location }),
    ...(ov.capacity && { capacity: ov.capacity }),
    overridden: true,
  };
}
