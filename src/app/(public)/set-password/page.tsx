import { SetPasswordForm } from "@/components/SetPasswordForm";

export const dynamic = "force-dynamic";

export default async function SetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const params = await searchParams;
  return (
    <div className="login-screen">
      <section className="login-copy">
        <div>
          <p className="kicker" style={{ color: "#d9c7a2" }}>Account</p>
          <h1>Set your password</h1>
          <p>This link comes from a MountainSeed admin. It expires after 72 hours.</p>
        </div>
      </section>
      <section className="login-panel">
        <div className="login-card">
          <h2>Choose a password</h2>
          <SetPasswordForm token={params.token || ""} />
        </div>
      </section>
    </div>
  );
}
