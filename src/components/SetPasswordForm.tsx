"use client";

import { useState } from "react";

export function SetPasswordForm({ token }: { token: string }) {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!token) return <p className="error">This link is missing a token.</p>;
  if (done) {
    return (
      <p className="ok">
        Password saved. <a href="/login">Sign in</a>
      </p>
    );
  }

  return (
    <form
      className="form"
      onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const password = String(data.get("password") || "");
        const confirm = String(data.get("confirm") || "");
        if (password !== confirm) {
          setError("Those passwords do not match.");
          return;
        }
        const response = await fetch("/api/auth/set-password", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token, password }),
        });
        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as { error?: string };
          setError(body.error || "Could not set the password.");
          return;
        }
        setDone(true);
      }}
    >
      <label>
        New password
        <input name="password" type="password" minLength={10} autoComplete="new-password" required />
      </label>
      <label>
        Confirm password
        <input name="confirm" type="password" minLength={10} autoComplete="new-password" required />
      </label>
      {error ? <p className="error">{error}</p> : null}
      <button className="primary" type="submit">
        Save password
      </button>
    </form>
  );
}
