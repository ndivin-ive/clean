CREATE TYPE "public"."ai_setting" AS ENUM('off', 'clean_default', 'byo');--> statement-breakpoint
CREATE TYPE "public"."decision_role" AS ENUM('decision_maker', 'sponsor', 'influencer', 'technical_evaluator', 'procurement', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."effort_activity" AS ENUM('prep', 'delivery', 'follow_up');--> statement-breakpoint
CREATE TYPE "public"."engagement_status" AS ENUM('draft', 'new', 'needs_information', 'accepted', 'scheduled', 'delivered', 'outcome_recorded', 'declined', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."locale" AS ENUM('en', 'fr');--> statement-breakpoint
CREATE TYPE "public"."outcome_result" AS ENUM('decision', 'next_step', 'qualified_out', 'no_progress');--> statement-breakpoint
CREATE TYPE "public"."account_relationship" AS ENUM('new_logo', 'expand', 'retain');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('account_executive', 'sales_manager', 'specialist', 'support_team_lead', 'admin');--> statement-breakpoint
CREATE TYPE "public"."template_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TABLE "auth_account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"active_organization_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "auth_user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"language" "locale" DEFAULT 'en' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "auth_verification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT app_current_org() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid DEFAULT app_current_user(),
	"email" text NOT NULL,
	"roles" "role"[] DEFAULT '{}' NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"accepted_by" uuid,
	CONSTRAINT "invitation_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "invitation_org_id_key" UNIQUE("organization_id","id")
);
--> statement-breakpoint
CREATE TABLE "membership" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT app_current_org() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid DEFAULT app_current_user(),
	"user_id" uuid NOT NULL,
	"roles" "role"[] DEFAULT '{}' NOT NULL,
	"skills" text[] DEFAULT '{}' NOT NULL,
	"languages" text[] DEFAULT '{}' NOT NULL,
	"regions" text[] DEFAULT '{}' NOT NULL,
	"weekly_bookable_hours" numeric(4, 1) DEFAULT 0 NOT NULL,
	"manager_user_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "membership_org_id_key" UNIQUE("organization_id","id"),
	CONSTRAINT "membership_org_user_key" UNIQUE("organization_id","user_id"),
	CONSTRAINT "membership_hours_range" CHECK ("membership"."weekly_bookable_hours" >= 0 AND "membership"."weekly_bookable_hours" <= 80),
	CONSTRAINT "membership_not_own_manager" CHECK ("membership"."manager_user_id" <> "membership"."user_id")
);
--> statement-breakpoint
CREATE TABLE "notification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT app_current_org() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid DEFAULT app_current_user(),
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"read_at" timestamp with time zone,
	CONSTRAINT "notification_org_id_key" UNIQUE("organization_id","id")
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid GENERATED ALWAYS AS (id) STORED NOT NULL,
	"name" text NOT NULL,
	"default_language" "locale" DEFAULT 'en' NOT NULL,
	"plan" text DEFAULT 'free' NOT NULL,
	"data_region" text DEFAULT 'eu' NOT NULL,
	"ai_setting" "ai_setting" DEFAULT 'off' NOT NULL,
	"setup_completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid DEFAULT app_current_user(),
	CONSTRAINT "organization_name_not_blank" CHECK (btrim("organization"."name") <> '')
);
--> statement-breakpoint
CREATE TABLE "engagement_type" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT app_current_org() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid DEFAULT app_current_user(),
	"support_function_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name_en" text NOT NULL,
	"name_fr" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "engagement_type_org_id_key" UNIQUE("organization_id","id"),
	CONSTRAINT "engagement_type_function_key_key" UNIQUE("support_function_id","key")
);
--> statement-breakpoint
CREATE TABLE "request_template" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT app_current_org() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid DEFAULT app_current_user(),
	"support_function_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"status" "template_status" DEFAULT 'draft' NOT NULL,
	"schema" jsonb NOT NULL,
	"published_at" timestamp with time zone,
	CONSTRAINT "request_template_org_id_key" UNIQUE("organization_id","id"),
	CONSTRAINT "request_template_function_version_key" UNIQUE("support_function_id","version")
);
--> statement-breakpoint
CREATE TABLE "scoring_rule_set" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT app_current_org() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid DEFAULT app_current_user(),
	"support_function_id" uuid NOT NULL,
	"weights" jsonb NOT NULL,
	"effort_bands" jsonb NOT NULL,
	"lead_times" jsonb NOT NULL,
	"flag_rules" jsonb NOT NULL,
	CONSTRAINT "scoring_rule_set_org_id_key" UNIQUE("organization_id","id"),
	CONSTRAINT "scoring_rule_set_function_key" UNIQUE("support_function_id")
);
--> statement-breakpoint
CREATE TABLE "support_function" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT app_current_org() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid DEFAULT app_current_user(),
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"service_rules" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "support_function_org_id_key" UNIQUE("organization_id","id"),
	CONSTRAINT "support_function_org_name_key" UNIQUE("organization_id","name")
);
--> statement-breakpoint
CREATE TABLE "support_function_member" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT app_current_org() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid DEFAULT app_current_user(),
	"support_function_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"is_lead" boolean DEFAULT false NOT NULL,
	CONSTRAINT "support_function_member_org_id_key" UNIQUE("organization_id","id"),
	CONSTRAINT "sfm_function_user_key" UNIQUE("support_function_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT app_current_org() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid DEFAULT app_current_user(),
	"name" text NOT NULL,
	"country" char(2),
	"industry" text,
	"relationship" "account_relationship" DEFAULT 'new_logo' NOT NULL,
	"owner_id" uuid NOT NULL,
	CONSTRAINT "account_org_id_key" UNIQUE("organization_id","id"),
	CONSTRAINT "account_name_not_blank" CHECK (btrim("account"."name") <> '')
);
--> statement-breakpoint
CREATE TABLE "contact" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT app_current_org() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid DEFAULT app_current_user(),
	"account_id" uuid NOT NULL,
	"name" text NOT NULL,
	"title" text,
	"email" text,
	"decision_role" "decision_role" DEFAULT 'unknown' NOT NULL,
	CONSTRAINT "contact_org_id_key" UNIQUE("organization_id","id")
);
--> statement-breakpoint
CREATE TABLE "opportunity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT app_current_org() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid DEFAULT app_current_user(),
	"account_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"amount" numeric(14, 2),
	"currency" char(3) DEFAULT 'EUR' NOT NULL,
	"stage_id" uuid NOT NULL,
	"close_date" date,
	"why_now" text,
	"next_step" text,
	"won_lost_reason" text,
	CONSTRAINT "opportunity_org_id_key" UNIQUE("organization_id","id"),
	CONSTRAINT "opportunity_amount_non_negative" CHECK ("opportunity"."amount" IS NULL OR "opportunity"."amount" >= 0),
	CONSTRAINT "opportunity_currency_format" CHECK ("opportunity"."currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
CREATE TABLE "opportunity_stage_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT app_current_org() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid DEFAULT app_current_user(),
	"opportunity_id" uuid NOT NULL,
	"from_stage_id" uuid,
	"to_stage_id" uuid NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "opportunity_stage_event_org_id_key" UNIQUE("organization_id","id")
);
--> statement-breakpoint
CREATE TABLE "pipeline_stage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT app_current_org() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid DEFAULT app_current_user(),
	"name_en" text NOT NULL,
	"name_fr" text NOT NULL,
	"sort_order" integer NOT NULL,
	"probability" integer NOT NULL,
	"is_won" boolean DEFAULT false NOT NULL,
	"is_lost" boolean DEFAULT false NOT NULL,
	CONSTRAINT "pipeline_stage_org_id_key" UNIQUE("organization_id","id"),
	CONSTRAINT "pipeline_stage_probability_range" CHECK ("pipeline_stage"."probability" BETWEEN 0 AND 100),
	CONSTRAINT "pipeline_stage_not_won_and_lost" CHECK (NOT ("pipeline_stage"."is_won" AND "pipeline_stage"."is_lost"))
);
--> statement-breakpoint
CREATE TABLE "booking" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT app_current_org() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid DEFAULT app_current_user(),
	"request_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"location_or_link" text,
	"external_calendar_ids" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "booking_org_id_key" UNIQUE("organization_id","id"),
	CONSTRAINT "booking_time_order" CHECK ("booking"."ends_at" > "booking"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "effort_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT app_current_org() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid DEFAULT app_current_user(),
	"request_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"hours" numeric(5, 2) NOT NULL,
	"activity" "effort_activity" NOT NULL,
	"date" date NOT NULL,
	CONSTRAINT "effort_entry_org_id_key" UNIQUE("organization_id","id"),
	CONSTRAINT "effort_hours_range" CHECK ("effort_entry"."hours" > 0 AND "effort_entry"."hours" <= 24)
);
--> statement-breakpoint
CREATE TABLE "engagement_assignment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT app_current_org() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid DEFAULT app_current_user(),
	"request_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	CONSTRAINT "engagement_assignment_org_id_key" UNIQUE("organization_id","id"),
	CONSTRAINT "ea_request_user_key" UNIQUE("request_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "engagement_outcome" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT app_current_org() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid DEFAULT app_current_user(),
	"request_id" uuid NOT NULL,
	"result" "outcome_result" NOT NULL,
	"notes" text,
	"deal_impact" smallint NOT NULL,
	CONSTRAINT "engagement_outcome_org_id_key" UNIQUE("organization_id","id"),
	CONSTRAINT "outcome_request_key" UNIQUE("request_id"),
	CONSTRAINT "outcome_deal_impact_range" CHECK ("engagement_outcome"."deal_impact" BETWEEN 1 AND 5)
);
--> statement-breakpoint
CREATE TABLE "engagement_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT app_current_org() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid DEFAULT app_current_user(),
	"opportunity_id" uuid,
	"requester_id" uuid NOT NULL,
	"support_function_id" uuid NOT NULL,
	"engagement_type_id" uuid,
	"template_id" uuid NOT NULL,
	"template_version" integer NOT NULL,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "engagement_status" DEFAULT 'draft' NOT NULL,
	"readiness_score" smallint,
	"readiness_breakdown" jsonb,
	"effort_points" integer,
	"effort_band" text,
	"flags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"target_date" date,
	"submitted_at" timestamp with time zone,
	CONSTRAINT "engagement_request_org_id_key" UNIQUE("organization_id","id"),
	CONSTRAINT "er_readiness_range" CHECK ("engagement_request"."readiness_score" IS NULL OR "engagement_request"."readiness_score" BETWEEN 0 AND 100)
);
--> statement-breakpoint
CREATE TABLE "engagement_status_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT app_current_org() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid DEFAULT app_current_user(),
	"request_id" uuid NOT NULL,
	"from_status" "engagement_status",
	"to_status" "engagement_status" NOT NULL,
	"by_user_id" uuid NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"note" text,
	CONSTRAINT "engagement_status_event_org_id_key" UNIQUE("organization_id","id")
);
--> statement-breakpoint
CREATE TABLE "audit_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"actor_id" uuid,
	"entity" text NOT NULL,
	"entity_id" uuid,
	"action" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth_account" ADD CONSTRAINT "auth_account_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_session" ADD CONSTRAINT "auth_session_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_accepted_by_auth_user_id_fk" FOREIGN KEY ("accepted_by") REFERENCES "public"."auth_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organization_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership" ADD CONSTRAINT "membership_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership" ADD CONSTRAINT "membership_organization_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership" ADD CONSTRAINT "membership_manager_fk" FOREIGN KEY ("organization_id","manager_user_id") REFERENCES "public"."membership"("organization_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_organization_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_fk" FOREIGN KEY ("organization_id","user_id") REFERENCES "public"."membership"("organization_id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagement_type" ADD CONSTRAINT "engagement_type_organization_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagement_type" ADD CONSTRAINT "engagement_type_function_fk" FOREIGN KEY ("organization_id","support_function_id") REFERENCES "public"."support_function"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_template" ADD CONSTRAINT "request_template_organization_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_template" ADD CONSTRAINT "request_template_function_fk" FOREIGN KEY ("organization_id","support_function_id") REFERENCES "public"."support_function"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scoring_rule_set" ADD CONSTRAINT "scoring_rule_set_organization_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scoring_rule_set" ADD CONSTRAINT "scoring_rule_set_function_fk" FOREIGN KEY ("organization_id","support_function_id") REFERENCES "public"."support_function"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_function" ADD CONSTRAINT "support_function_organization_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_function_member" ADD CONSTRAINT "support_function_member_organization_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_function_member" ADD CONSTRAINT "sfm_function_fk" FOREIGN KEY ("organization_id","support_function_id") REFERENCES "public"."support_function"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_function_member" ADD CONSTRAINT "sfm_user_fk" FOREIGN KEY ("organization_id","user_id") REFERENCES "public"."membership"("organization_id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_organization_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_owner_fk" FOREIGN KEY ("organization_id","owner_id") REFERENCES "public"."membership"("organization_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact" ADD CONSTRAINT "contact_organization_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact" ADD CONSTRAINT "contact_account_fk" FOREIGN KEY ("organization_id","account_id") REFERENCES "public"."account"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity" ADD CONSTRAINT "opportunity_organization_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity" ADD CONSTRAINT "opportunity_account_fk" FOREIGN KEY ("organization_id","account_id") REFERENCES "public"."account"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity" ADD CONSTRAINT "opportunity_stage_fk" FOREIGN KEY ("organization_id","stage_id") REFERENCES "public"."pipeline_stage"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity" ADD CONSTRAINT "opportunity_owner_fk" FOREIGN KEY ("organization_id","owner_id") REFERENCES "public"."membership"("organization_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_stage_event" ADD CONSTRAINT "opportunity_stage_event_organization_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_stage_event" ADD CONSTRAINT "ose_opportunity_fk" FOREIGN KEY ("organization_id","opportunity_id") REFERENCES "public"."opportunity"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_stage_event" ADD CONSTRAINT "ose_from_stage_fk" FOREIGN KEY ("organization_id","from_stage_id") REFERENCES "public"."pipeline_stage"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_stage_event" ADD CONSTRAINT "ose_to_stage_fk" FOREIGN KEY ("organization_id","to_stage_id") REFERENCES "public"."pipeline_stage"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_stage" ADD CONSTRAINT "pipeline_stage_organization_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_organization_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_request_fk" FOREIGN KEY ("organization_id","request_id") REFERENCES "public"."engagement_request"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "effort_entry" ADD CONSTRAINT "effort_entry_organization_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "effort_entry" ADD CONSTRAINT "effort_request_fk" FOREIGN KEY ("organization_id","request_id") REFERENCES "public"."engagement_request"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "effort_entry" ADD CONSTRAINT "effort_user_fk" FOREIGN KEY ("organization_id","user_id") REFERENCES "public"."membership"("organization_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagement_assignment" ADD CONSTRAINT "engagement_assignment_organization_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagement_assignment" ADD CONSTRAINT "ea_request_fk" FOREIGN KEY ("organization_id","request_id") REFERENCES "public"."engagement_request"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagement_assignment" ADD CONSTRAINT "ea_user_fk" FOREIGN KEY ("organization_id","user_id") REFERENCES "public"."membership"("organization_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagement_outcome" ADD CONSTRAINT "engagement_outcome_organization_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagement_outcome" ADD CONSTRAINT "outcome_request_fk" FOREIGN KEY ("organization_id","request_id") REFERENCES "public"."engagement_request"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagement_request" ADD CONSTRAINT "engagement_request_organization_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagement_request" ADD CONSTRAINT "er_opportunity_fk" FOREIGN KEY ("organization_id","opportunity_id") REFERENCES "public"."opportunity"("organization_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagement_request" ADD CONSTRAINT "er_function_fk" FOREIGN KEY ("organization_id","support_function_id") REFERENCES "public"."support_function"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagement_request" ADD CONSTRAINT "er_engagement_type_fk" FOREIGN KEY ("organization_id","engagement_type_id") REFERENCES "public"."engagement_type"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagement_request" ADD CONSTRAINT "er_template_fk" FOREIGN KEY ("organization_id","template_id") REFERENCES "public"."request_template"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagement_request" ADD CONSTRAINT "er_requester_fk" FOREIGN KEY ("organization_id","requester_id") REFERENCES "public"."membership"("organization_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagement_status_event" ADD CONSTRAINT "engagement_status_event_organization_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagement_status_event" ADD CONSTRAINT "ese_request_fk" FOREIGN KEY ("organization_id","request_id") REFERENCES "public"."engagement_request"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagement_status_event" ADD CONSTRAINT "ese_by_user_fk" FOREIGN KEY ("organization_id","by_user_id") REFERENCES "public"."membership"("organization_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auth_account_user_id_idx" ON "auth_account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "auth_session_user_id_idx" ON "auth_session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "auth_verification_identifier_idx" ON "auth_verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "invitation_org_email_idx" ON "invitation" USING btree ("organization_id","email");--> statement-breakpoint
CREATE INDEX "membership_user_idx" ON "membership" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notification_user_unread_idx" ON "notification" USING btree ("organization_id","user_id","read_at");--> statement-breakpoint
CREATE INDEX "account_org_name_idx" ON "account" USING btree ("organization_id","name");--> statement-breakpoint
CREATE INDEX "contact_account_idx" ON "contact" USING btree ("organization_id","account_id");--> statement-breakpoint
CREATE INDEX "opportunity_owner_idx" ON "opportunity" USING btree ("organization_id","owner_id");--> statement-breakpoint
CREATE INDEX "opportunity_stage_idx" ON "opportunity" USING btree ("organization_id","stage_id");--> statement-breakpoint
CREATE INDEX "ose_opportunity_idx" ON "opportunity_stage_event" USING btree ("organization_id","opportunity_id","at");--> statement-breakpoint
CREATE INDEX "effort_request_idx" ON "effort_entry" USING btree ("organization_id","request_id");--> statement-breakpoint
CREATE INDEX "ea_user_idx" ON "engagement_assignment" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "er_function_status_idx" ON "engagement_request" USING btree ("organization_id","support_function_id","status");--> statement-breakpoint
CREATE INDEX "er_requester_idx" ON "engagement_request" USING btree ("organization_id","requester_id");--> statement-breakpoint
CREATE INDEX "er_opportunity_idx" ON "engagement_request" USING btree ("organization_id","opportunity_id");--> statement-breakpoint
CREATE INDEX "ese_request_idx" ON "engagement_status_event" USING btree ("organization_id","request_id","at");--> statement-breakpoint
CREATE INDEX "audit_event_entity_idx" ON "audit_event" USING btree ("organization_id","entity","entity_id","at");--> statement-breakpoint
CREATE INDEX "audit_event_at_idx" ON "audit_event" USING btree ("organization_id","at");