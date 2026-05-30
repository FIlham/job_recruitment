ALTER TABLE "applicants" DROP CONSTRAINT "applicants_job_id_recruiter_id_pk";--> statement-breakpoint
ALTER TABLE "applicants" ADD COLUMN "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "applicants" ADD COLUMN "name" varchar(100) NOT NULL;--> statement-breakpoint
ALTER TABLE "applicants" ADD COLUMN "email" varchar(100) NOT NULL;