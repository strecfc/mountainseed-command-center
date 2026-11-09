import { LoginForm } from "@/components/LoginForm";
import { currentUser } from "@/lib/current-user";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

function safeNext(value: string | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/login")) return "/";
  return value;
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const user = await currentUser();
  if (user) redirect("/");
  const params = await searchParams;
  return (
    <div className="login-screen">
      <section className="login-copy">
        <div>
          <p className="kicker" style={{ color: "#d9c7a2" }}>Private</p>
          <h1>MountainSeed</h1>
          <p>Leadership Command Center. A single view of whether the company is on track for 2027.</p>
        </div>
        <p className="fine" style={{ color: "#d9c7a2" }}>Accounts are issued by an admin. There is no public sign-up.</p>
      </section>
      <section className="login-panel">
        <div className="login-card">
          <h2>Sign in</h2>
          <p className="lede">Use the email and password on your account.</p>
          <LoginForm next={safeNext(params.next)} />
        </div>
      </section>
    </div>
  );
}
