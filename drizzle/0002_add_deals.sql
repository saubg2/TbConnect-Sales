CREATE TABLE "deals" (
  "id" text PRIMARY KEY NOT NULL,
  "workspace_id" text NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "owner" text NOT NULL,
  "name" text NOT NULL,
  "contact_id" text REFERENCES "contacts"("id") ON DELETE SET NULL,
  "organization_id" text REFERENCES "organizations"("id") ON DELETE SET NULL,
  "probability" integer DEFAULT 0 NOT NULL,
  "stage" text DEFAULT 'QUALIFICATION' NOT NULL,
  "amount" integer,
  "closing_date" timestamp with time zone,
  "description" text,
  "rep" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "deals_probability_check" CHECK ("probability" >= 0 AND "probability" <= 100),
  CONSTRAINT "deals_amount_check" CHECK ("amount" IS NULL OR "amount" >= 0)
);
--> statement-breakpoint
CREATE INDEX "deals_workspace_stage_idx" ON "deals" USING btree ("workspace_id","stage");
--> statement-breakpoint
CREATE INDEX "deals_workspace_contact_idx" ON "deals" USING btree ("workspace_id","contact_id");
