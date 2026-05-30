import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const statusEnum = pgEnum("status", ["hired", "applied", "interview"]);
export const roleEnum = pgEnum("role", ["recruiter", "applicant"]);

export const user = pgTable("users", {
  id: text("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  email: varchar("email", { length: 50 }).notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
  role: roleEnum("role").notNull(),
});

export const job = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description").notNull(),
    recruiter: text("recruiter_id")
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
  },
  (table) => [index("recruited_idx").on(table.recruiter)],
);

export const applicant = pgTable("applicants", {
  id: uuid("id").primaryKey().defaultRandom(),
  recruiterId: text("recruiter_id")
    .references(() => user.id)
    .notNull(),
  jobId: uuid("job_id")
    .references(() => job.id)
    .notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  email: varchar("email", { length: 100 }).notNull(),
  status: statusEnum("status").default("applied").notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const usersRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  jobs: many(job),
  applicants: many(applicant),
}));

export const jobsRelations = relations(job, ({ one, many }) => ({
  applicants: many(applicant),
  recruiter: one(user, {
    fields: [job.recruiter],
    references: [user.id],
  }),
}));

export const applicantsRelations = relations(applicant, ({ one }) => ({
  recruiter: one(user, {
    fields: [applicant.recruiterId],
    references: [user.id],
  }),
  job: one(job, {
    fields: [applicant.jobId],
    references: [job.id],
  }),
}));

export type UserSelect = typeof user.$inferSelect;
export type UserInsert = typeof user.$inferInsert;

export type JobSelect = typeof job.$inferSelect;
export type JobInsert = typeof job.$inferInsert;

export type ApplicantSelect = typeof applicant.$inferSelect;
export type ApplicantInsert = typeof applicant.$inferInsert;
