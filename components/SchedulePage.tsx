"use client";

import { useState } from "react";
import Calendar from "./Calendar";
import type { Class } from "@/lib/types";

type Props = {
  initialClasses: Class[];
};

export default function SchedulePage({ initialClasses }: Props) {
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);

  return (
    <>
      {/* Header */}
      <header className="header">
        <div className="header-inner">
          <div className="header-top">
            <div className="header-brand">
              <img className="header-logo" src="/icon-192.png" alt="AOP Shala NYC" />
              <div>
                <div className="header-title">AOP Shala NYC</div>
                <div className="header-sub">
                  <span className="live-dot" />
                  Live — shared with everyone
                </div>
              </div>
            </div>
          </div>

          {/* WeekNav is rendered inside Calendar so it stays in sync with week state */}
        </div>
      </header>

      {/* Calendar (manages its own week state + Realtime) */}
      <Calendar
        classes={initialClasses}
        onClassClick={(id) => setSelectedClassId(id)}
      />

      {/* Signup modal — Phase 3 */}
      {selectedClassId && (
        <div className="overlay" onClick={() => setSelectedClassId(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Reserve Your Spot</h3>
            <p style={{ marginTop: 12, color: "#9a7d5e", fontSize: 14 }}>
              Signup coming in Phase 3.
            </p>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setSelectedClassId(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
