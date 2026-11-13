import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ms-pglite-"));
process.env.PGLITE_DIR = dir;
process.env.DATABASE_URL = "";
process.env.ADMIN_EMAIL = "Carl@mountainseed.com";
process.env.ADMIN_PASSWORD = "Correct-horse-battery-staple";
process.env.ADMIN_NAME = "Carl Streck";
process.env.APP_BASE_URL = "http://localhost:3000";
process.env.ENABLE_DAILY_JOB = "false";
process.env.CRON_SECRET = "test-cron-secret";
process.env.SESSION_HOURS = "18";
delete process.env.SF_CLIENT_ID;
delete process.env.SF_CLIENT_SECRET;
delete process.env.SF_USERNAME;
delete process.env.SF_PASSWORD;
delete process.env.SF_SECURITY_TOKEN;
