import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import z from "zod";
import { db } from "@/database";
import { applicant, job } from "@/database/schema";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";

type Variables = {
  user: typeof auth.$Infer.Session.user | null;
  session: typeof auth.$Infer.Session.session | null;
};

export const candidateRoute = new Hono<{ Variables: Variables }>()
  .get(
    "/",
    zValidator(
      "query",
      z.object({
        jobId: z.string().optional(),
        status: z.enum(["applied", "interview", "hired"]).optional(),
      }),
    ),
    async (c) => {
      const user = c.get("user");
      if (!user) return c.json({ message: "Unauthorized" }, 401);
      if (user.role !== "recruiter") return c.json({ message: "Forbidden" }, 403);
      const { jobId, status } = c.req.valid("query");
      const conditions = [eq(applicant.recruiterId, user.id)];
      if (jobId) conditions.push(eq(applicant.jobId, jobId));
      if (status) conditions.push(eq(applicant.status, status));
      const candidates = await db.query.applicant.findMany({
        where: (and(...conditions) as any),
        with: { job: true },
        orderBy: (applicant, { desc }) => [desc(applicant.updatedAt)],
      });
      return c.json({ data: candidates });
    },
  )
  .post(
    "/",
    zValidator(
      "json",
      z.object({
        name: z.string().min(1),
        email: z.string().email(),
        jobId: z.string().uuid(),
      }),
    ),
    async (c) => {
      const body = c.req.valid("json");
      const user = c.get("user");
      if (!user) return c.json({ message: "Unauthorized" }, 401);
      const [foundJob] = await db
        .select({ recruiter: job.recruiter })
        .from(job)
        .where(eq(job.id, body.jobId))
        .limit(1);
      if (!foundJob) return c.json({ message: "Job not found" }, 404);
      const recruiterId = user.role === "recruiter" ? user.id : foundJob.recruiter;
      const [newCandidate] = await db
        .insert(applicant)
        .values({
          name: body.name,
          email: body.email,
          jobId: body.jobId,
          recruiterId,
        })
        .returning();
      return c.json({ data: newCandidate }, 201);
    },
  )
  .patch(
    "/:id",
    zValidator("param", z.object({ id: z.string() })),
    zValidator(
      "json",
      z.object({ status: z.enum(["applied", "interview", "hired"]) }),
    ),
    async (c) => {
      const user = c.get("user");
      if (!user) return c.json({ message: "Unauthorized" }, 401);
      if (user.role !== "recruiter") return c.json({ message: "Forbidden" }, 403);
      const { id } = c.req.valid("param");
      const { status } = c.req.valid("json");
      const [updated] = await db
        .update(applicant)
        .set({ status })
        .where(and(eq(applicant.id, id), eq(applicant.recruiterId, user.id)))
        .returning();
      if (!updated) return c.json({ message: "Not found" }, 404);
      return c.json({ data: updated });
    },
  );
