"use client";

import Calendar from "./Calendar";
import type { Class } from "@/lib/types";

type Props = {
  initialClasses: Class[];
};

export default function SchedulePage({ initialClasses }: Props) {
  return (
    <>
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
        </div>
      </header>

      <Calendar classes={initialClasses} />
    </>
  );
}
