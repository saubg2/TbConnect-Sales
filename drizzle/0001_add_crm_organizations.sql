CREATE TABLE "organizations" (
  "id" text PRIMARY KEY NOT NULL,
  "workspace_id" text NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "type" text DEFAULT 'Other' NOT NULL,
  "website" text,
  "address" text,
  "country" text,
  "owner" text,
  "phone" text,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_workspace_name_idx" ON "organizations" USING btree ("workspace_id","name");
--> statement-breakpoint
CREATE INDEX "organizations_workspace_type_idx" ON "organizations" USING btree ("workspace_id","type");
--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "organization_id" text;
--> statement-breakpoint
INSERT INTO "organizations" (id, workspace_id, name, type, country)
SELECT
  md5(source.workspace_id || ':' || lower(source.name)),
  source.workspace_id,
  source.name,
  CASE
    WHEN lower(source.name) ~ '(minister|ministry|national[[:space:]]+(tb|tuberculosis)[[:space:]]+program)' THEN 'Government'
    WHEN lower(source.name) ~ '(university|institute|institutet|college|hospital)' THEN 'Academic/Hospital'
    ELSE 'Other'
  END,
  source.country
FROM (
  SELECT DISTINCT ON (workspace_id, lower(trim(organisation)))
    workspace_id,
    trim(organisation) AS name,
    nullif(trim(country), '') AS country
  FROM "contacts"
  WHERE nullif(trim(organisation), '') IS NOT NULL
  ORDER BY workspace_id, lower(trim(organisation)), updated_at DESC
) source
ON CONFLICT (workspace_id, name) DO NOTHING;
--> statement-breakpoint
UPDATE "contacts" c
SET "organization_id" = o.id
FROM "organizations" o
WHERE o.workspace_id = c.workspace_id AND lower(o.name) = lower(trim(c.organisation));
--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_organization_id_organizations_id_fk"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL;
--> statement-breakpoint
CREATE INDEX "contacts_workspace_organization_idx" ON "contacts" USING btree ("workspace_id","organization_id");
