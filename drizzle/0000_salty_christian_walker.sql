CREATE TABLE "actions" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"relationship_id" text NOT NULL,
	"agent_id" text NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"scheduled_at" timestamp with time zone,
	"payload_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"reason" text,
	"approval_required" boolean DEFAULT false NOT NULL,
	"approved_draft_version" integer,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"idempotency_key" text NOT NULL,
	"provider_reference" text,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agents" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"goal" text NOT NULL,
	"instructions" text NOT NULL,
	"knowledge_text" text,
	"voice_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"permissions_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"llm_provider" text DEFAULT 'mock' NOT NULL,
	"llm_model" text DEFAULT 'mock-agent-v1' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"email_normalized" text NOT NULL,
	"organisation" text,
	"country" text,
	"tags_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"is_suppressed" boolean DEFAULT false NOT NULL,
	"suppression_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"relationship_id" text,
	"action_id" text,
	"event_type" text NOT NULL,
	"external_event_id" text,
	"payload_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"permissions_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"relationship_id" text NOT NULL,
	"direction" text NOT NULL,
	"channel" text DEFAULT 'EMAIL' NOT NULL,
	"subject" text,
	"body_text" text NOT NULL,
	"body_html" text,
	"provider" text DEFAULT 'mock' NOT NULL,
	"provider_message_id" text,
	"internet_message_id" text,
	"in_reply_to" text,
	"thread_key" text,
	"status" text DEFAULT 'RECEIVED' NOT NULL,
	"draft_version" integer DEFAULT 1,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"received_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "relationships" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"contact_id" text NOT NULL,
	"agent_id" text NOT NULL,
	"stage" text DEFAULT 'NEW' NOT NULL,
	"summary" text,
	"facts_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"open_questions_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"current_action_id" text,
	"last_inbound_at" timestamp with time zone,
	"last_outbound_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"settings_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_relationship_id_relationships_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_relationship_id_relationships_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_action_id_actions_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."actions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_relationship_id_relationships_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "actions_workspace_relationship_idx" ON "actions" USING btree ("workspace_id","relationship_id");--> statement-breakpoint
CREATE UNIQUE INDEX "actions_idempotency_idx" ON "actions" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "actions_status_scheduled_idx" ON "actions" USING btree ("workspace_id","status","scheduled_at");--> statement-breakpoint
CREATE INDEX "agents_workspace_idx" ON "agents" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "contacts_workspace_email_idx" ON "contacts" USING btree ("workspace_id","email_normalized");--> statement-breakpoint
CREATE INDEX "contacts_workspace_suppressed_idx" ON "contacts" USING btree ("workspace_id","is_suppressed");--> statement-breakpoint
CREATE INDEX "events_workspace_relationship_idx" ON "events" USING btree ("workspace_id","relationship_id");--> statement-breakpoint
CREATE INDEX "events_type_idx" ON "events" USING btree ("workspace_id","event_type");--> statement-breakpoint
CREATE INDEX "events_external_id_idx" ON "events" USING btree ("workspace_id","external_event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_workspace_user_idx" ON "memberships" USING btree ("workspace_id","user_id");--> statement-breakpoint
CREATE INDEX "messages_workspace_relationship_idx" ON "messages" USING btree ("workspace_id","relationship_id");--> statement-breakpoint
CREATE INDEX "messages_provider_msg_idx" ON "messages" USING btree ("workspace_id","provider_message_id");--> statement-breakpoint
CREATE INDEX "messages_thread_key_idx" ON "messages" USING btree ("workspace_id","thread_key");--> statement-breakpoint
CREATE UNIQUE INDEX "relationships_workspace_contact_agent_idx" ON "relationships" USING btree ("workspace_id","contact_id","agent_id");--> statement-breakpoint
CREATE INDEX "relationships_workspace_stage_idx" ON "relationships" USING btree ("workspace_id","stage");