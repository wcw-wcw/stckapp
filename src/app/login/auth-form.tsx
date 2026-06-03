"use client";

import { useState } from "react";

export function AuthForm() {
  const [mode, setMode] = useState<"login" | "register">("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(undefined);
    const response = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setLoading(false);
      setError(payload.error ?? "Could not continue.");
      return;
    }
    window.location.href = "/";
  }

  return (
    <>
      <form className="auth-form" onSubmit={submit}>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" autoComplete="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" autoComplete={mode === "register" ? "new-password" : "current-password"} minLength={mode === "register" ? 10 : 1} type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        </div>
        {mode === "register" && <p className="small">Use at least 10 characters. Passwords are hashed locally with scrypt.</p>}
        {error && <p className="notice">{error}</p>}
        <button className="button" disabled={loading}>{loading ? "Working..." : mode === "register" ? "Create local account" : "Log in"}</button>
      </form>
      <button className="text-button auth-switch" onClick={() => { setError(undefined); setMode(mode === "register" ? "login" : "register"); }}>
        {mode === "register" ? "Already have an account? Log in" : "Need an account? Register"}
      </button>
    </>
  );
}
