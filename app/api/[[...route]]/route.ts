import { Hono } from "hono";
import { handle } from "hono/vercel";
import { auth } from "@/lib/auth";
import { db } from "@/database";
import { job, applicant } from "@/database/schema";
import { jobRoute } from "./job";
import { candidateRoute } from "./candidate";

export const dynamic = "force-dynamic";

const allowedOrigins = (process.env.APP_URL || "http://localhost:3000")
  .split(",")
  .map((o) => o.trim().replace(/\/$/, ""));

const app = new Hono<{
  Variables: {
    user: typeof auth.$Infer.Session.user | null;
    session: typeof auth.$Infer.Session.session | null;
  };
}>()
  .basePath("/api")
  .on(["POST", "GET"], "/auth/*", (c) => auth.handler(c.req.raw))
  .use("*", async (c, next) => {
    if (c.req.path.startsWith("/auth")) return next();
    const method = c.req.method;
    if (["POST", "PATCH", "DELETE", "PUT"].includes(method)) {
      const origin = c.req.header("origin");
      if (origin && !allowedOrigins.includes(origin)) {
        return c.json({ message: "Forbidden" }, 403);
      }
    }
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) return c.json({ message: "Unauthorized" }, 401);
    c.set("user", session.user);
    c.set("session", session.session);
    await next();
  })
  .route("/jobs", jobRoute)
  .route("/candidates", candidateRoute)
  .get("/stats", async (c) => {
    const [totalJobs, totalCandidates] = await Promise.all([
      db.$count(job),
      db.$count(applicant),
    ]);
    return c.json({
      data: {
        totalJobs,
        totalCandidates,
        totalApplications: totalCandidates,
      },
    });
  })
  .get("/", (c) => c.json({ message: "Hello, world!" }));

export const GET = handle(app);
export const POST = handle(app);
