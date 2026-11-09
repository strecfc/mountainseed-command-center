import { metaGet, metaSet, ready } from "./db";
import { runDailyPull } from "./salesforce";

let timer: NodeJS.Timeout | null = null;
let running = false;

async function maybeRun(): Promise<void> {
  if (running) return;
  const hour = Number(process.env.DAILY_JOB_UTC_HOUR ?? 11);
  const now = new Date();
  if (now.getUTCHours() !== hour) return;
  const key = now.toISOString().slice(0, 10);
  await ready();
  const last = await metaGet("daily_job_date");
  if (last === key) return;
  running = true;
  try {
    await metaSet("daily_job_date", key);
    await runDailyPull();
  } finally {
    running = false;
  }
}

export function startDailyJob(): void {
  if (timer || process.env.ENABLE_DAILY_JOB === "false") return;
  timer = setInterval(() => {
    void maybeRun().catch((error) => {
      console.error("Daily Salesforce job failed", error instanceof Error ? error.message : error);
    });
  }, 30 * 60 * 1000);
  timer.unref?.();
  void maybeRun().catch(() => undefined);
}
