"use client";

import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import Calendar from "./Calendar";
import AdminNotifications from "./AdminNotifications";
import { ADMIN_EMAILS } from "@/lib/adminEmails";
import type { Class } from "@/lib/types";

type Props = {
  initialClasses: Class[];
};

export default function SchedulePage({ initialClasses }: Props) {
  const { user } = useUser();
  const isAdmin = !!user?.emailAddresses.some((e) => ADMIN_EMAILS.includes(e.emailAddress));

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
            <Link href="/admin" style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, textDecoration: "none" }}>
              ⚙ Admin
            </Link>
          </div>
        </div>
      </header>

      {isAdmin && (
        <div style={{ maxWidth: 800, margin: "16px auto 0", padding: "0 16px" }}>
          <AdminNotifications />
        </div>
      )}

      <Calendar classes={initialClasses} />
    </>
  );
}
