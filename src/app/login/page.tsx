import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { AuthForm } from "./auth-form";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  return (
    <div className="page auth-page">
      <section className="card auth-card">
        <p className="eyebrow">Local account</p>
        <h1>Welcome back.</h1>
        <p className="subhead">Your account, rules, and watchlist stay on this machine for now.</p>
        <AuthForm />
      </section>
    </div>
  );
}
