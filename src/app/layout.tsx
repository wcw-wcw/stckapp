import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { AccountMenu } from "./account-menu";
import "./globals.css";

export const metadata: Metadata = {
  title: "SignalDesk",
  description: "Rule-based market alerts for research and informational use.",
};

const navItems = [
  ["Overview", "/"],
  ["Rules", "/rules"],
  ["Replay", "/replay"],
  ["Watchlist", "/watchlist"],
  ["Alerts", "/alerts"],
  ["Profile", "/profile"],
];

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <Link className="brand" href="/">
            <span className="brand-mark">S</span>
            <span>SignalDesk</span>
          </Link>
          <nav aria-label="Main navigation">
            {navItems.map(([label, href]) => (
              <Link href={href} key={href}>
                {label}
              </Link>
            ))}
          </nav>
          <div className="demo-chip">
            <span className="status-dot" />
            Mock mode
          </div>
          {user ? <AccountMenu email={user.email} /> : <Link className="nav-button" href="/login">Log in</Link>}
        </header>
        <main>{children}</main>
        <footer>
          For research and informational purposes only. SignalDesk does not
          provide financial advice and does not execute trades.
        </footer>
      </body>
    </html>
  );
}
