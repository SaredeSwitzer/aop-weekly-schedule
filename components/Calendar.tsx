"use client";

import { useEffect, useReducer, useCallback, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  DISPLAY_ORDER, DISPLAY_SHORT, START_HOUR, END_HOUR, HOUR_PX,
  getWeekDates, getWeekKey, getEffectiveClass,
} from "@/lib/dates";
import type { Class, Signup, Override, SignupMap, OverrideMap } from "@/lib/types";
import ClassBlock from "./ClassBlock";
import WeekNav from "./WeekNav";
import SignupModal from "./SignupModal";

type State = {
  weekKey: string;
  signups: SignupMap;
  overrides: OverrideMap;
  loading: boolean;
};

type Action =
  | { type: "SET_WEEK"; key: string }
  | { type: "SET_DATA"; signups: SignupMap; overrides: OverrideMap }
  | { type: "SIGNUP_CHANGE"; signup: Signup; event: "INSERT" | "DELETE" }
  | { type: "OVERRIDE_CHANGE"; override: Override; event: "INSERT" | "UPDATE" | "DELETE" };

function toSignupMap(rows: Signup[]): SignupMap {
  return rows.reduce<SignupMap>((acc, s) => {
    (acc[s.class_id] ??= []).push(s);
    return acc;
  }, {});
}

function toOverrideMap(rows: Override[]): OverrideMap {
  return rows.reduce<OverrideMap>((acc, o) => {
    acc[o.class_id] = o;
    return acc;
  }, {});
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_WEEK":
      return { ...state, weekKey: action.key, loading: true, signups: {}, overrides: {} };
    case "SET_DATA":
      return { ...state, signups: action.signups, overrides: action.overrides, loading: false };
    case "SIGNUP_CHANGE": {
      const map = { ...state.signups };
      if (action.event === "INSERT") {
        const list = [...(map[action.signup.class_id] ?? [])];
        list.push(action.signup);
        map[action.signup.class_id] = list;
      } else {
        // DELETE payload may only include id — search all buckets
        for (const classId of Object.keys(map)) {
          const idx = map[classId].findIndex((s) => s.id === action.signup.id);
          if (idx !== -1) {
            const list = [...map[classId]];
            list.splice(idx, 1);
            map[classId] = list;
            break;
          }
        }
      }
      return { ...state, signups: map };
    }
    case "OVERRIDE_CHANGE": {
      const map = { ...state.overrides };
      if (action.event === "DELETE") {
        delete map[action.override.class_id];
      } else {
        map[action.override.class_id] = action.override;
      }
      return { ...state, overrides: map };
    }
  }
}

type Props = {
  classes: Class[];
};

export default function Calendar({ classes }: Props) {
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [state, dispatch] = useReducer(reducer, {
    weekKey: getWeekKey(new Date()),
    signups: {},
    overrides: {},
    loading: true,
  });

  const { weekKey, signups, overrides, loading } = state;

  // Fetch signups + overrides for current week
  const fetchWeekData = useCallback(async (key: string) => {
    const [sRes, oRes] = await Promise.all([
      fetch(`/api/signups?week=${key}`),
      fetch(`/api/overrides?week=${key}`),
    ]);
    const [signupRows, overrideRows]: [Signup[], Override[]] = await Promise.all([
      sRes.json(),
      oRes.json(),
    ]);
    dispatch({ type: "SET_DATA", signups: toSignupMap(signupRows), overrides: toOverrideMap(overrideRows) });
  }, []);

  // Subscribe to Realtime for current week
  useEffect(() => {
    fetchWeekData(weekKey);

    const signupChannel = supabase
      .channel(`signups-${weekKey}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "signups",
        filter: `week_key=eq.${weekKey}`,
      }, (payload) => {
        dispatch({
          type: "SIGNUP_CHANGE",
          signup: (payload.new ?? payload.old) as Signup,
          event: payload.eventType as "INSERT" | "DELETE",
        });
      })
      .subscribe();

    const overrideChannel = supabase
      .channel(`overrides-${weekKey}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "overrides",
        filter: `week_key=eq.${weekKey}`,
      }, (payload) => {
        dispatch({
          type: "OVERRIDE_CHANGE",
          override: (payload.new ?? payload.old) as Override,
          event: payload.eventType as "INSERT" | "UPDATE" | "DELETE",
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(signupChannel);
      supabase.removeChannel(overrideChannel);
    };
  }, [weekKey, fetchWeekData]);

  function handleWeekChange(key: string) {
    dispatch({ type: "SET_WEEK", key });
  }

  const dates = getWeekDates(weekKey);
  const todayStr = new Date().toDateString();
  const totalHours = END_HOUR - START_HOUR;
  const bodyH = totalHours * HOUR_PX;

  return (
    <>
      <div className="week-nav-bar">
        <div className="week-nav-inner">
          <WeekNav weekKey={weekKey} onChange={handleWeekChange} />
        </div>
      </div>
      <div className="main">
<div className="calendar-scroll">
          <div className="calendar-wrap">
            {/* Header row */}
            <div className="cal-header">
              <div style={{ borderRight: "1px solid #ede5dc" }} />
              {dates.map((date, col) => {
                const isToday = date.toDateString() === todayStr;
                return (
                  <div key={col} className={`cal-header-cell${isToday ? " today" : ""}`}>
                    <div className="day-name">{DISPLAY_SHORT[col]}</div>
                    <div className="day-num">{date.getDate()}</div>
                  </div>
                );
              })}
            </div>

            {/* Body */}
            <div className="cal-body">
              {/* Time gutter */}
              <div className="time-col">
                {Array.from({ length: totalHours }, (_, h) => {
                  const hour = START_HOUR + h;
                  const label = hour === 0 ? "12a" : hour < 12 ? `${hour}a` : hour === 12 ? "12p" : `${hour - 12}p`;
                  return (
                    <div key={h} className="time-slot" style={{ height: HOUR_PX }}>
                      {label}
                    </div>
                  );
                })}
              </div>

              {/* Day columns */}
              {Array.from({ length: 7 }, (_, col) => {
                const dayIdx = DISPLAY_ORDER[col];
                const dayClasses = classes
                  .map((c) => getEffectiveClass(c, overrides))
                  .filter((c): c is Class => c !== null && c.day === dayIdx)
                  .sort((a, b) => a.time.localeCompare(b.time));

                return (
                  <div key={col} className="day-col" style={{ height: bodyH }}>
                    {Array.from({ length: totalHours }, (_, h) => (
                      <div key={h}>
                        <div className="hour-line" style={{ top: h * HOUR_PX }} />
                        <div className="half-line" style={{ top: h * HOUR_PX + HOUR_PX / 2 }} />
                      </div>
                    ))}
                    {loading ? null : dayClasses.map((cls) => (
                      <ClassBlock
                        key={cls.id}
                        cls={cls}
                        signups={signups}
                        onClick={setSelectedClassId}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {loading && (
          <div style={{ textAlign: "center", padding: "40px", color: "#aaa" }}>
            <span className="spinner" /> Loading schedule…
          </div>
        )}
      </div>

      {selectedClassId && (() => {
        const cls = classes
          .map((c) => getEffectiveClass(c, overrides))
          .find((c): c is Class => c !== null && c.id === selectedClassId);
        if (!cls) return null;
        return (
          <SignupModal
            cls={cls}
            signups={signups[selectedClassId] ?? []}
            weekKey={weekKey}
            onClose={() => setSelectedClassId(null)}
            onSignupSuccess={() => { setSelectedClassId(null); fetchWeekData(weekKey); }}
            onCancelSuccess={() => { setSelectedClassId(null); fetchWeekData(weekKey); }}
          />
        );
      })()}
    </>
  );
}
