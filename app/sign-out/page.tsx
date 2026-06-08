"use client";

import { useClerk } from "@clerk/nextjs";
import { useEffect } from "react";

export default function SignOutPage() {
  const { signOut } = useClerk();
  useEffect(() => {
    signOut({ redirectUrl: "/sign-in" });
  }, [signOut]);
  return (
    <div style={{ textAlign: "center", padding: "60px", color: "#9a7d5e" }}>
      Signing out…
    </div>
  );
}
