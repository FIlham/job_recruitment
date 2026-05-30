import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import z from "zod";
import { db } from "@/database";
import { job } from "@/database/schema";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";

type Variables = {
  user: typeof auth.$Infer.Session.user | null;
  session: typeof auth.$Infer.Session.session | null;
};

export const jobRoute = new Hono<{ Variables: Variables }>()
  .get(
    "/",
    zValidator("query", z.object({ name: z.string().optional() })),
    async (c) => {
      const { name } = c.req.valid("query");
      if (name) {
        const jobs = await db.query.job.findMany({
          where: (job, { ilike }) => ilike(job.name, `%${name}%`),
          with: { applicants: true, recruiter: true },
        });
        return c.json({ data: jobs });
      }
      const jobs = await db.query.job.findMany({
        with: { applicants: true, recruiter: true },
      });
      return c.json({ data: jobs });
    },
  )
  .post(
    "/",
    zValidator(
      "json",
      z.object({
        name: z.string().min(1),
        description: z.string().min(1),
      }),
    ),
    async (c) => {
      const user = c.get("user");
      if (!user) return c.json({ message: "Unauthorized" }, 401);
      if (user.role !== "recruiter") return c.json({ message: "Forbidden" }, 403);
      const body = c.req.valid("json");
      const [newJob] = await db
        .insert(job)
        .values({ name: body.name, description: body.description, recruiter: user.id })
        .returning();
      return c.json({ data: newJob }, 201);
    },
  )
  .patch(
    "/:id",
    zValidator("param", z.object({ id: z.string() })),
    zValidator(
      "json",
      z.object({
        name: z.string().min(1),
        description: z.string().min(1),
      }),
    ),
    async (c) => {
      const user = c.get("user");
      if (!user) return c.json({ message: "Unauthorized" }, 401);
      if (user.role !== "recruiter") return c.json({ message: "Forbidden" }, 403);
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");
      const [updated] = await db
        .update(job)
        .set({ name: body.name, description: body.description })
        .where(and(eq(job.id, id), eq(job.recruiter, user.id)))
        .returning();
      if (!updated) return c.json({ message: "Not found" }, 404);
      return c.json({ data: updated });
    },
  )
  .delete(
    "/:id",
    zValidator("param", z.object({ id: z.string() })),
    async (c) => {
      const user = c.get("user");
      if (!user) return c.json({ message: "Unauthorized" }, 401);
      if (user.role !== "recruiter") return c.json({ message: "Forbidden" }, 403);
      const { id } = c.req.valid("param");
      const [deleted] = await db
        .delete(job)
        .where(and(eq(job.id, id), eq(job.recruiter, user.id)))
        .returning();
      if (!deleted) return c.json({ message: "Not found" }, 404);
      return c.json({ message: "Deleted" });
    },
  );
