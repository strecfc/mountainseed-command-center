"use client";

import { useState } from "react";

export function NotesForm({
  weekEnding,
  whatChanged,
  owner,
  nextStep,
  canEdit,
}: {
  weekEnding: string;
  whatChanged: string;
  owner: string;
  nextStep: string;
  canEdit: boolean;
}) {
  const [message, setMessage] = useState<string | null>(null);
  if (!canEdit) {
    return (
      <div className="panel">
        <p><strong>What changed.</strong> {whatChanged || "Awaiting data"}</p>
        <p><strong>Owner.</strong> {owner || "Awaiting data"}</p>
        <p><strong>Next step.</strong> {nextStep || "Awaiting data"}</p>
      </div>
    );
  }
  return (
    <form
      className="form"
      onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const response = await fetch("/api/notes", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            weekEnding: data.get("weekEnding"),
            whatChanged: data.get("whatChanged"),
            owner: data.get("owner"),
            nextStep: data.get("nextStep"),
          }),
        });
        setMessage(response.ok ? "Saved." : "Could not save.");
      }}
    >
      <label>
        Week ending
        <input name="weekEnding" type="date" defaultValue={weekEnding} required />
      </label>
      <label>
        What changed
        <textarea name="whatChanged" defaultValue={whatChanged} />
      </label>
      <label>
        Owner
        <input name="owner" defaultValue={owner} />
      </label>
      <label>
        Next step
        <textarea name="nextStep" defaultValue={nextStep} />
      </label>
      {message ? <p className={message === "Saved." ? "ok" : "error"}>{message}</p> : null}
      <button className="primary" type="submit">Save notes</button>
    </form>
  );
}
