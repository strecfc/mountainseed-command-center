import { json, readJson, requireAdmin } from "@/lib/http";
import { intakeScorecard, rowsToMetrics } from "@/lib/intake";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await requireAdmin(req);
  if (user instanceof Response) return user;
  const type = req.headers.get("content-type") || "";
  try {
    if (type.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      const text = form.get("text");
      if (typeof text === "string" && text.trim()) {
        return json(await intakeScorecard({ text, actor: user.email, source: "manual", sourceDetail: `Pasted by ${user.email}` }));
      }
      if (file instanceof File) {
        const buffer = Buffer.from(await file.arrayBuffer());
        if (buffer.length > 15 * 1024 * 1024) return json({ error: "File is larger than 15 MB." }, 400);
        return json(
          await intakeScorecard({
            buffer,
            filename: file.name,
            actor: user.email,
            source: "manual",
            sourceDetail: `Uploaded by ${user.email} · ${file.name}`,
          }),
        );
      }
      return json({ error: "Choose a file or paste scorecard text." }, 400);
    }
    const body = (await readJson(req)) as {
      text?: string;
      weekEnding?: string;
      rows?: { label: string; section?: string; category?: string; value?: string; wkGoal?: string; qtdGoal?: string; totalQtd?: string; avgQtd?: string }[];
    } | null;
    if (body?.text) {
      return json(await intakeScorecard({ text: body.text, actor: user.email, source: "manual", sourceDetail: `Pasted by ${user.email}` }));
    }
    const metrics = rowsToMetrics(
      (body?.rows || []).map((row) => ({ ...row, weekEnding: body?.weekEnding, value: row.value })),
    );
    return json(await intakeScorecard({ metrics, actor: user.email, source: "manual", sourceDetail: `Entered by ${user.email}` }));
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Upload failed." }, 400);
  }
}
