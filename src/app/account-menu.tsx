"use client";

import Link from "next/link";
import { useState } from "react";

export function AccountMenu({ email }: { email: string }) {
  const [open, setOpen] = useState(false);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <div className="account-menu">
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        className="account-trigger"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="account-avatar">{email.slice(0, 1).toUpperCase()}</span>
        <span className="account-trigger-copy">Account</span>
        <span aria-hidden="true" className="account-chevron">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div aria-label="Account menu" className="account-dropdown" role="menu">
          <div className="account-email">{email}</div>
          <Link href="/rules" role="menuitem">Manage rules</Link>
          <Link href="/alerts" role="menuitem">Alert history</Link>
          <Link href="/diagnostics" role="menuitem">Local diagnostics</Link>
          <Link href="/profile" role="menuitem">Profile and notifications</Link>
          <button onClick={logout} role="menuitem">Log out</button>
        </div>
      )}
    </div>
  );
}
