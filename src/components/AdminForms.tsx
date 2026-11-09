"use client";

import { useState } from "react";

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "viewer";
  disabled: boolean;
};

export function UsersAdmin({ users }: { users: UserRow[] }) {
  const [rows, setRows] = useState(users);
  const [invite, setInvite] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const response = await fetch("/api/admin/users");
    const body = (await response.json()) as { users: UserRow[] };
    setRows(body.users);
  }

  return (
    <div className="stack">
      <form
        className="form panel"
        onSubmit={async (event) => {
          event.preventDefault();
          setError(null);
          const data = new FormData(event.currentTarget);
          const response = await fetch("/api/admin/users", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              email: data.get("email"),
              name: data.get("name"),
              role: data.get("role"),
              temporaryPassword: data.get("temporaryPassword") || undefined,
              generateInvite: data.get("generateInvite") === "on",
            }),
          });
          const body = (await response.json()) as { error?: string; invite?: string | null };
          if (!response.ok) {
            setError(body.error || "Could not create the user.");
            return;
          }
          setInvite(body.invite || null);
          event.currentTarget.reset();
          await refresh();
        }}
      >
        <h2 className="section-title" style={{ fontSize: 24 }}>Add a person</h2>
        <label>Name<input name="name" required /></label>
        <label>Email<input name="email" type="email" required /></label>
        <label>
          Role
          <select name="role" defaultValue="viewer">
            <option value="viewer">Viewer</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <label>Temporary password<input name="temporaryPassword" type="text" minLength={10} placeholder="At least 10 characters, or leave blank" /></label>
        <label style={{ fontWeight: 500 }}><span><input type="checkbox" name="generateInvite" /> Generate an invite link</span></label>
        {error ? <p className="error">{error}</p> : null}
        {invite ? <p className="ok">Invite link (shown once): {invite}</p> : null}
        <button className="primary" type="submit">Create account</button>
      </form>
      <div className="panel scroll">
        <table>
          <thead>
            <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td>{row.email}</td>
                <td>{row.role}</td>
                <td>{row.disabled ? "Disabled" : "Active"}</td>
                <td>
                  <div className="row-actions">
                    <button className="secondary" type="button" onClick={async () => {
                      const response = await fetch(`/api/admin/users/${row.id}`, {
                        method: "PATCH",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({ disabled: !row.disabled }),
                      });
                      if (response.ok) await refresh();
                    }}>{row.disabled ? "Enable" : "Disable"}</button>
                    <button className="secondary" type="button" onClick={async () => {
                      const password = window.prompt("Temporary password (10+ characters)");
                      if (!password) return;
                      const response = await fetch(`/api/admin/users/${row.id}`, {
                        method: "PATCH",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({ temporaryPassword: password }),
                      });
                      const body = (await response.json()) as { error?: string };
                      if (!response.ok) setError(body.error || "Reset failed.");
                    }}>Reset password</button>
                    <button className="secondary" type="button" onClick={async () => {
                      const response = await fetch(`/api/admin/users/${row.id}`, {
                        method: "PATCH",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({ generateInvite: true }),
                      });
                      const body = (await response.json()) as { invite?: string; error?: string };
                      if (response.ok && body.invite) setInvite(body.invite);
                      else setError(body.error || "Could not create a link.");
                    }}>Invite link</button>
                    <button className="secondary" type="button" onClick={async () => {
                      if (!window.confirm(`Delete ${row.email}?`)) return;
                      const response = await fetch(`/api/admin/users/${row.id}`, { method: "DELETE" });
                      const body = (await response.json()) as { error?: string };
                      if (!response.ok) setError(body.error || "Could not delete.");
                      else await refresh();
                    }}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function UploadForms({ metrics }: { metrics: { label: string; section: string }[] }) {
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="stack">
      <form className="form panel" onSubmit={async (event) => {
        event.preventDefault();
        const response = await fetch("/api/admin/uploads/scorecard", { method: "POST", body: new FormData(event.currentTarget) });
        const body = (await response.json()) as { error?: string; message?: string };
        setMessage(body.error || body.message || "Saved.");
      }}>
        <h2 className="section-title" style={{ fontSize: 24 }}>Weekly scorecard</h2>
        <p className="lede">Upload xlsx or CSV, or paste the email body. Week history is kept.</p>
        <label>File<input name="file" type="file" accept=".xlsx,.csv,.txt" /></label>
        <label>Or paste the scorecard<textarea name="text" placeholder="=== MarketPlace ===" /></label>
        <button className="primary" type="submit">Save scorecard</button>
      </form>
      <form className="form panel" onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const rows = metrics
          .map((metric) => ({ label: metric.label, section: metric.section, value: String(data.get(metric.label) || "") }))
          .filter((row) => row.value);
        const response = await fetch("/api/admin/uploads/scorecard", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ weekEnding: data.get("weekEnding"), rows }),
        });
        const body = (await response.json()) as { error?: string; message?: string };
        setMessage(body.error || body.message || "Saved.");
      }}>
        <h2 className="section-title" style={{ fontSize: 24 }}>Enter one week</h2>
        <label>Week ending<input name="weekEnding" type="date" required /></label>
        {metrics.map((metric) => (
          <label key={metric.label}>
            {metric.label}
            <input name={metric.label} />
          </label>
        ))}
        <button className="primary" type="submit">Save week</button>
      </form>
      <form className="form panel" onSubmit={async (event) => {
        event.preventDefault();
        const response = await fetch("/api/admin/uploads/budget", { method: "POST", body: new FormData(event.currentTarget) });
        const body = (await response.json()) as { error?: string; periods?: number; warnings?: string[] };
        setMessage(body.error || `Saved ${body.periods || 0} month(s). ${(body.warnings || []).join(" ")}`);
      }}>
        <h2 className="section-title" style={{ fontSize: 24 }}>Monthly budget vs actual</h2>
        <p className="lede">Example filename: LT Budget vs Actual October 2026.xlsx. Revenue, gross margin, EBITDA, and expenses are matched from the parser mapping.</p>
        <label>Workbook<input name="file" type="file" accept=".xlsx" required /></label>
        <button className="primary" type="submit">Upload workbook</button>
      </form>
      <form className="form panel" onSubmit={async (event) => {
        event.preventDefault();
        const response = await fetch("/api/admin/uploads/orders", { method: "POST", body: new FormData(event.currentTarget) });
        const body = (await response.json()) as { error?: string; rows?: number };
        setMessage(body.error || `Imported ${body.rows} order rows. The latest upload replaces prior order lines.`);
      }}>
        <h2 className="section-title" style={{ fontSize: 24 }}>ValuTrac order export</h2>
        <p className="lede">CSV with client, completed date, appraiser type (CRA or fee), fee, cost, turn time, and revision.</p>
        <label>CSV<input name="file" type="file" accept=".csv,.txt" required /></label>
        <button className="primary" type="submit">Upload orders</button>
      </form>
      {message ? <p className="ok">{message}</p> : null}
    </div>
  );
}

export function TargetsForm({ targets }: { targets: { key: string; label: string; value_numeric: number | null; unit: string }[] }) {
  const [message, setMessage] = useState<string | null>(null);
  return (
    <form className="form panel" onSubmit={async (event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const payload = targets.map((target) => ({
        key: target.key,
        value: data.get(target.key) === "" ? null : Number(data.get(target.key)),
      }));
      const response = await fetch("/api/admin/targets", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targets: payload }),
      });
      setMessage(response.ok ? "Targets saved." : "Could not save targets.");
    }}>
      {targets.map((target) => (
        <label key={target.key}>
          {target.label} ({target.unit === "usd" ? "dollars" : "percent"})
          <input name={target.key} type="number" step="any" defaultValue={target.value_numeric ?? ""} />
        </label>
      ))}
      {message ? <p className="ok">{message}</p> : null}
      <button className="primary" type="submit">Save targets</button>
    </form>
  );
}

export function MappingForm({ mapping }: { mapping: unknown }) {
  const [message, setMessage] = useState<string | null>(null);
  return (
    <form className="form panel" onSubmit={async (event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      try {
        const parsed = JSON.parse(String(data.get("mapping") || ""));
        const response = await fetch("/api/admin/mapping", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ mapping: parsed }),
        });
        const body = (await response.json()) as { error?: string };
        setMessage(response.ok ? "Mapping saved." : body.error || "Could not save.");
      } catch {
        setMessage("That is not valid JSON.");
      }
    }}>
      <label>
        Budget row labels
        <textarea name="mapping" defaultValue={JSON.stringify(mapping, null, 2)} />
      </label>
      {message ? <p className="ok">{message}</p> : null}
      <button className="primary" type="submit">Save mapping</button>
    </form>
  );
}

export function IngestAdmin({ tokens }: { tokens: { id: string; name: string; token_prefix: string; revoked_at: string | null }[] }) {
  const [list, setList] = useState(tokens);
  const [token, setToken] = useState<string | null>(null);
  return (
    <div className="stack">
      <form className="form panel" onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const response = await fetch("/api/admin/ingest-tokens", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: data.get("name") }),
        });
        const body = (await response.json()) as { token?: string };
        setToken(body.token || null);
        const next = await fetch("/api/admin/ingest-tokens");
        const rows = (await next.json()) as { tokens: typeof tokens };
        setList(rows.tokens);
      }}>
        <label>Token name<input name="name" placeholder="Weekly bot" required /></label>
        <button className="primary" type="submit">Create token</button>
        {token ? <p className="ok">Copy this token now. It will not be shown again: {token}</p> : null}
      </form>
      <div className="panel">
        {list.map((item) => (
          <p key={item.id}>
            {item.name} · {item.token_prefix}… · {item.revoked_at ? "Revoked" : "Active"}{" "}
            {!item.revoked_at ? (
              <button className="secondary" type="button" onClick={async () => {
                await fetch(`/api/admin/ingest-tokens/${item.id}`, { method: "DELETE" });
                setList(list.map((row) => (row.id === item.id ? { ...row, revoked_at: new Date().toISOString() } : row)));
              }}>Revoke</button>
            ) : null}
          </p>
        ))}
      </div>
    </div>
  );
}

export function SalesforceButton({ state, message }: { state: string; message: string }) {
  const [text, setText] = useState(message);
  return (
    <div className="panel">
      <p><strong>{state === "not_connected" ? "Not connected" : state}</strong></p>
      <p className="lede">{text}</p>
      <button className="primary" type="button" onClick={async () => {
        const response = await fetch("/api/admin/salesforce/sync", { method: "POST" });
        const body = (await response.json()) as { message?: string; status?: string };
        setText(body.message || body.status || "Finished.");
      }}>Sync now</button>
    </div>
  );
}
