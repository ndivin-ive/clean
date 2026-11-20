CREATE TYPE "public"."account_relationship" AS ENUM('prospect', 'customer');--> statement-breakpoint
CREATE TYPE "public"."account_tier" AS ENUM('key', 'growth', 'maintain');--> statement-breakpoint
CREATE TYPE "public"."action_origin" AS ENUM('rule', 'ai', 'manual');--> statement-breakpoint
CREATE TYPE "public"."action_status" AS ENUM('open', 'done', 'snoozed', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."ai_provider" AS ENUM('off', 'clean_default', 'anthropic', 'openai', 'mistral', 'azure_openai');--> statement-breakpoint
CREATE TYPE "public"."brief_generator" AS ENUM('rules', 'ai');--> statement-breakpoint
CREATE TYPE "public"."deal_event_kind" AS ENUM('stage', 'close_date', 'forecast', 'amount', 'qualification');--> statement-breakpoint
CREATE TYPE "public"."decision_role" AS ENUM('economic_buyer', 'decision_maker', 'champion', 'influencer', 'technical_evaluator', 'user', 'procurement', 'blocker', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."forecast_category" AS ENUM('commit', 'best_case', 'pipeline', 'omitted');--> statement-breakpoint
CREATE TYPE "public"."interaction_source" AS ENUM('manual', 'paste', 'voice', 'calendar', 'email', 'transcript');--> statement-breakpoint
CREATE TYPE "public"."interaction_type" AS ENUM('meeting', 'call', 'email', 'note', 'event');--> statement-breakpoint
CREATE TYPE "public"."locale" AS ENUM('en', 'fr');--> statement-breakpoint
CREATE TYPE "public"."proposal_status" AS ENUM('pending', 'approved', 'edited', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."qualification_status" AS ENUM('unknown', 'partial', 'confirmed');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('seller', 'manager', 'admin', 'specialist');--> statement-breakpoint
CREATE TYPE "public"."signal_source" AS ENUM('manual', 'rss', 'webhook', 'import');--> statement-breakpoint
CREATE TYPE "public"."signal_type" AS ENUM('job_change', 'news', 'funding', 'hiring', 'tender', 'product_launch', 'usage_drop', 'renewal_window', 'custom');--> statement-breakpoint
CREATE TYPE "public"."stance" AS ENUM('supporter', 'neutral', 'sceptic', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."step_owner" AS ENUM('buyer', 'seller');--> statement-breakpoint
CREATE TYPE "public"."support_status" AS ENUM('open', 'accepted', 'done', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."theme" AS ENUM('light', 'dark', 'system');--> statement-breakpoint
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
	"theme" "theme" DEFAULT 'light' NOT NULL,
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
	"roles" "role"[] DEFAULT '{seller}' NOT NULL,
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
	"roles" "role"[] DEFAULT '{seller}' NOT NULL,
	"manager_user_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "membership_org_id_key" UNIQUE("organization_id","id"),
	CONSTRAINT "membership_org_user_key" UNIQUE("organization_id","user_id"),
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
	"team_visibility" boolean DEFAULT false NOT NULL,
	"fiscal_year_start_month" smallint DEFAULT 1 NOT NULL,
	"setup_completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid DEFAULT app_current_user(),
	CONSTRAINT "organization_name_not_blank" CHECK (btrim("organization"."name") <> ''),
	CONSTRAINT "organization_fiscal_month_range" CHECK ("organization"."fiscal_year_start_month" BETWEEN 1 AND 12)
);
--> statement-breakpoint
CREATE TABLE "ai_provider_setting" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT app_current_org() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid DEFAULT app_current_user(),
	"provider" "ai_provider" DEFAULT 'off' NOT NULL,
	"endpoint" text,
	"encrypted_key" text,
	"enabled_features" text[] DEFAULT '{}' NOT NULL,
	CONSTRAINT "ai_provider_setting_org_id_key" UNIQUE("organization_id","id"),
	CONSTRAINT "ai_provider_setting_org_key" UNIQUE("organization_id")
);
--> statement-breakpoint
CREATE TABLE "feature_flag" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT app_current_org() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid DEFAULT app_current_user(),
	"key" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	CONSTRAINT "feature_flag_org_id_key" UNIQUE("organization_id","id"),
	CONSTRAINT "feature_flag_org_key_key" UNIQUE("organization_id","key")
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
	"exit_criterion_en" text DEFAULT '' NOT NULL,
	"exit_criterion_fr" text DEFAULT '' NOT NULL,
	"sort_order" integer NOT NULL,
	"probability" integer NOT NULL,
	"typical_days" integer DEFAULT 21 NOT NULL,
	"is_won" boolean DEFAULT false NOT NULL,
	"is_lost" boolean DEFAULT false NOT NULL,
	CONSTRAINT "pipeline_stage_org_id_key" UNIQUE("organization_id","id"),
	CONSTRAINT "pipeline_stage_probability_range" CHECK ("pipeline_stage"."probability" BETWEEN 0 AND 100),
	CONSTRAINT "pipeline_stage_typical_days_range" CHECK ("pipeline_stage"."typical_days" BETWEEN 0 AND 365),
	CONSTRAINT "pipeline_stage_not_won_and_lost" CHECK (NOT ("pipeline_stage"."is_won" AND "pipeline_stage"."is_lost"))
);
--> statement-breakpoint
CREATE TABLE "qualification_criterion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT app_current_org() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid DEFAULT app_current_user(),
	"key" text NOT NULL,
	"label_en" text NOT NULL,
	"label_fr" text NOT NULL,
	"help_en" text DEFAULT '' NOT NULL,
	"help_fr" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"required_late" boolean DEFAULT false NOT NULL,
	CONSTRAINT "qualification_criterion_org_id_key" UNIQUE("organization_id","id"),
	CONSTRAINT "qualification_criterion_org_key_key" UNIQUE("organization_id","key")
);
--> statement-breakpoint
CREATE TABLE "role_cadence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT app_current_org() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid DEFAULT app_current_user(),
	"role" "decision_role" NOT NULL,
	"days" integer NOT NULL,
	CONSTRAINT "role_cadence_org_id_key" UNIQUE("organization_id","id"),
	CONSTRAINT "role_cadence_org_role_key" UNIQUE("organization_id","role"),
	CONSTRAINT "role_cadence_days_range" CHECK ("role_cadence"."days" BETWEEN 1 AND 365)
);
--> statement-breakpoint
CREATE TABLE "rule_setting" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT app_current_org() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid DEFAULT app_current_user(),
	"key" text NOT NULL,
	"value" numeric(12, 4) NOT NULL,
	CONSTRAINT "rule_setting_org_id_key" UNIQUE("organization_id","id"),
	CONSTRAINT "rule_setting_org_key_key" UNIQUE("organization_id","key")
);
--> statement-breakpoint
CREATE TABLE "user_rule_adjustment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT app_current_org() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid DEFAULT app_current_user(),
	"owner_id" uuid DEFAULT app_current_user() NOT NULL,
	"rule_key" text NOT NULL,
	"multiplier" numeric(4, 2) DEFAULT 1 NOT NULL,
	CONSTRAINT "user_rule_adjustment_org_id_key" UNIQUE("organization_id","id"),
	CONSTRAINT "user_rule_adjustment_org_owner_id_key" UNIQUE("organization_id","owner_id","id"),
	CONSTRAINT "user_rule_adjustment_owner_rule_key" UNIQUE("organization_id","owner_id","rule_key"),
	CONSTRAINT "user_rule_adjustment_range" CHECK ("user_rule_adjustment"."multiplier" BETWEEN 0.4 AND 1)
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT app_current_org() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid DEFAULT app_current_user(),
	"owner_id" uuid DEFAULT app_current_user() NOT NULL,
	"name" text NOT NULL,
	"domain" text,
	"country" char(2),
	"industry" text,
	"segment" text,
	"tier" "account_tier" DEFAULT 'growth' NOT NULL,
	"relationship" "account_relationship" DEFAULT 'prospect' NOT NULL,
	"annual_value" numeric(14, 2),
	"currency" char(3) DEFAULT 'EUR' NOT NULL,
	"renewal_date" date,
	"next_review_date" date,
	CONSTRAINT "account_org_id_key" UNIQUE("organization_id","id"),
	CONSTRAINT "account_org_owner_id_key" UNIQUE("organization_id","owner_id","id"),
	CONSTRAINT "account_name_not_blank" CHECK (btrim("account"."name") <> ''),
	CONSTRAINT "account_currency_format" CHECK ("account"."currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
CREATE TABLE "account_plan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT app_current_org() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid DEFAULT app_current_user(),
	"owner_id" uuid DEFAULT app_current_user() NOT NULL,
	"account_id" uuid NOT NULL,
	"objectives" text DEFAULT '' NOT NULL,
	"our_goals" text DEFAULT '' NOT NULL,
	"whitespace" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"risks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"value_delivered" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"next_moves" text DEFAULT '' NOT NULL,
	"last_reviewed_at" timestamp with time zone,
	CONSTRAINT "account_plan_org_id_key" UNIQUE("organization_id","id"),
	CONSTRAINT "account_plan_org_owner_id_key" UNIQUE("organization_id","owner_id","id"),
	CONSTRAINT "account_plan_account_key" UNIQUE("organization_id","account_id")
);
--> statement-breakpoint
CREATE TABLE "person" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT app_current_org() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid DEFAULT app_current_user(),
	"owner_id" uuid DEFAULT app_current_user() NOT NULL,
	"account_id" uuid NOT NULL,
	"name" text NOT NULL,
	"title" text,
	"department" text,
	"email" text,
	"phone" text,
	"linkedin_url" text,
	"notes" text,
	CONSTRAINT "person_org_id_key" UNIQUE("organization_id","id"),
	CONSTRAINT "person_org_owner_id_key" UNIQUE("organization_id","owner_id","id")
);
--> statement-breakpoint
CREATE TABLE "relationship" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT app_current_org() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid DEFAULT app_current_user(),
	"owner_id" uuid DEFAULT app_current_user() NOT NULL,
	"person_id" uuid NOT NULL,
	"decision_role" "decision_role" DEFAULT 'unknown' NOT NULL,
	"stance" "stance" DEFAULT 'unknown' NOT NULL,
	"strength" smallint DEFAULT 1 NOT NULL,
	"last_interaction_at" timestamp with time zone,
	"next_touch_due" date,
	CONSTRAINT "relationship_org_id_key" UNIQUE("organization_id","id"),
	CONSTRAINT "relationship_org_owner_id_key" UNIQUE("organization_id","owner_id","id"),
	CONSTRAINT "relationship_owner_person_key" UNIQUE("organization_id","owner_id","person_id"),
	CONSTRAINT "relationship_strength_range" CHECK ("relationship"."strength" BETWEEN 1 AND 5)
);
--> statement-breakpoint
CREATE TABLE "signal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT app_current_org() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid DEFAULT app_current_user(),
	"owner_id" uuid DEFAULT app_current_user() NOT NULL,
	"account_id" uuid NOT NULL,
	"person_id" uuid,
	"type" "signal_type" NOT NULL,
	"title" text NOT NULL,
	"url" text,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" "signal_source" DEFAULT 'manual' NOT NULL,
	"relevance" smallint,
	CONSTRAINT "signal_org_id_key" UNIQUE("organization_id","id"),
	CONSTRAINT "signal_org_owner_id_key" UNIQUE("organization_id","owner_id","id"),
	CONSTRAINT "signal_relevance_range" CHECK ("signal"."relevance" IS NULL OR "signal"."relevance" BETWEEN 1 AND 5)
);
--> statement-breakpoint
CREATE TABLE "close_plan_step" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT app_current_org() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid DEFAULT app_current_user(),
	"owner_id" uuid DEFAULT app_current_user() NOT NULL,
	"deal_id" uuid NOT NULL,
	"title" text NOT NULL,
	"step_owner" "step_owner" DEFAULT 'seller' NOT NULL,
	"due_date" date,
	"done_at" timestamp with time zone,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "close_plan_step_org_id_key" UNIQUE("organization_id","id"),
	CONSTRAINT "close_plan_step_org_owner_id_key" UNIQUE("organization_id","owner_id","id")
);
--> statement-breakpoint
CREATE TABLE "deal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT app_current_org() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid DEFAULT app_current_user(),
	"owner_id" uuid DEFAULT app_current_user() NOT NULL,
	"account_id" uuid NOT NULL,
	"name" text NOT NULL,
	"amount" numeric(14, 2),
	"currency" char(3) DEFAULT 'EUR' NOT NULL,
	"stage_id" uuid NOT NULL,
	"close_date" date,
	"compelling_event" text,
	"next_step" text,
	"next_step_date" date,
	"forecast_category" "forecast_category",
	"won_lost_reason" text,
	"stage_entered_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deal_org_id_key" UNIQUE("organization_id","id"),
	CONSTRAINT "deal_org_owner_id_key" UNIQUE("organization_id","owner_id","id"),
	CONSTRAINT "deal_amount_non_negative" CHECK ("deal"."amount" IS NULL OR "deal"."amount" >= 0),
	CONSTRAINT "deal_currency_format" CHECK ("deal"."currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
CREATE TABLE "deal_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT app_current_org() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid DEFAULT app_current_user(),
	"owner_id" uuid DEFAULT app_current_user() NOT NULL,
	"deal_id" uuid NOT NULL,
	"kind" "deal_event_kind" NOT NULL,
	"field" text,
	"from_value" text,
	"to_value" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deal_event_org_id_key" UNIQUE("organization_id","id"),
	CONSTRAINT "deal_event_org_owner_id_key" UNIQUE("organization_id","owner_id","id")
);
--> statement-breakpoint
CREATE TABLE "deal_qualification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT app_current_org() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid DEFAULT app_current_user(),
	"owner_id" uuid DEFAULT app_current_user() NOT NULL,
	"deal_id" uuid NOT NULL,
	"criterion_key" text NOT NULL,
	"status" "qualification_status" DEFAULT 'unknown' NOT NULL,
	"evidence" text,
	"source_interaction_id" uuid,
	CONSTRAINT "deal_qualification_org_id_key" UNIQUE("organization_id","id"),
	CONSTRAINT "deal_qualification_org_owner_id_key" UNIQUE("organization_id","owner_id","id"),
	CONSTRAINT "deal_qualification_deal_criterion_key" UNIQUE("deal_id","criterion_key")
);
--> statement-breakpoint
CREATE TABLE "deal_stakeholder" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT app_current_org() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid DEFAULT app_current_user(),
	"owner_id" uuid DEFAULT app_current_user() NOT NULL,
	"deal_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"role_in_deal" "decision_role" DEFAULT 'unknown' NOT NULL,
	CONSTRAINT "deal_stakeholder_org_id_key" UNIQUE("organization_id","id"),
	CONSTRAINT "deal_stakeholder_org_owner_id_key" UNIQUE("organization_id","owner_id","id"),
	CONSTRAINT "deal_stakeholder_deal_person_key" UNIQUE("deal_id","person_id")
);
--> statement-breakpoint
CREATE TABLE "action" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT app_current_org() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid DEFAULT app_current_user(),
	"owner_id" uuid DEFAULT app_current_user() NOT NULL,
	"account_id" uuid,
	"deal_id" uuid,
	"person_id" uuid,
	"rule_key" text NOT NULL,
	"subject_key" text NOT NULL,
	"fingerprint" text DEFAULT '' NOT NULL,
	"title" text,
	"reason_code" text,
	"reason_text" text,
	"score" integer,
	"due_at" timestamp with time zone,
	"status" "action_status" DEFAULT 'open' NOT NULL,
	"snoozed_until" timestamp with time zone,
	"origin" "action_origin" DEFAULT 'rule' NOT NULL,
	CONSTRAINT "action_org_id_key" UNIQUE("organization_id","id"),
	CONSTRAINT "action_org_owner_id_key" UNIQUE("organization_id","owner_id","id"),
	CONSTRAINT "action_owner_rule_subject_key" UNIQUE("organization_id","owner_id","rule_key","subject_key")
);
--> statement-breakpoint
CREATE TABLE "capture_proposal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT app_current_org() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid DEFAULT app_current_user(),
	"owner_id" uuid DEFAULT app_current_user() NOT NULL,
	"interaction_id" uuid,
	"batch_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" uuid,
	"change" jsonb NOT NULL,
	"source_kind" "interaction_source" DEFAULT 'paste' NOT NULL,
	"source_line" integer,
	"source_excerpt" text,
	"status" "proposal_status" DEFAULT 'pending' NOT NULL,
	"decided_at" timestamp with time zone,
	CONSTRAINT "capture_proposal_org_id_key" UNIQUE("organization_id","id"),
	CONSTRAINT "capture_proposal_org_owner_id_key" UNIQUE("organization_id","owner_id","id")
);
--> statement-breakpoint
CREATE TABLE "interaction" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT app_current_org() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid DEFAULT app_current_user(),
	"owner_id" uuid DEFAULT app_current_user() NOT NULL,
	"account_id" uuid NOT NULL,
	"deal_id" uuid,
	"type" "interaction_type" NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"title" text,
	"summary" text DEFAULT '' NOT NULL,
	"source" "interaction_source" DEFAULT 'manual' NOT NULL,
	CONSTRAINT "interaction_org_id_key" UNIQUE("organization_id","id"),
	CONSTRAINT "interaction_org_owner_id_key" UNIQUE("organization_id","owner_id","id")
);
--> statement-breakpoint
CREATE TABLE "interaction_participant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT app_current_org() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid DEFAULT app_current_user(),
	"owner_id" uuid DEFAULT app_current_user() NOT NULL,
	"interaction_id" uuid NOT NULL,
	"person_id" uuid,
	"user_id" uuid,
	CONSTRAINT "interaction_participant_org_id_key" UNIQUE("organization_id","id"),
	CONSTRAINT "interaction_participant_org_owner_id_key" UNIQUE("organization_id","owner_id","id"),
	CONSTRAINT "interaction_participant_one_party" CHECK (("interaction_participant"."person_id" IS NULL) <> ("interaction_participant"."user_id" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "meeting_brief" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT app_current_org() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid DEFAULT app_current_user(),
	"owner_id" uuid DEFAULT app_current_user() NOT NULL,
	"interaction_id" uuid NOT NULL,
	"content" jsonb NOT NULL,
	"generated_by" "brief_generator" DEFAULT 'rules' NOT NULL,
	"viewed_at" timestamp with time zone,
	CONSTRAINT "meeting_brief_org_id_key" UNIQUE("organization_id","id"),
	CONSTRAINT "meeting_brief_org_owner_id_key" UNIQUE("organization_id","owner_id","id"),
	CONSTRAINT "meeting_brief_interaction_key" UNIQUE("organization_id","interaction_id")
);
--> statement-breakpoint
CREATE TABLE "support_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT app_current_org() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid DEFAULT app_current_user(),
	"owner_id" uuid DEFAULT app_current_user() NOT NULL,
	"deal_id" uuid NOT NULL,
	"team" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"status" "support_status" DEFAULT 'open' NOT NULL,
	CONSTRAINT "support_request_org_id_key" UNIQUE("organization_id","id"),
	CONSTRAINT "support_request_org_owner_id_key" UNIQUE("organization_id","owner_id","id")
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
ALTER TABLE "ai_provider_setting" ADD CONSTRAINT "ai_provider_setting_organization_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feature_flag" ADD CONSTRAINT "feature_flag_organization_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_stage" ADD CONSTRAINT "pipeline_stage_organization_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qualification_criterion" ADD CONSTRAINT "qualification_criterion_organization_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_cadence" ADD CONSTRAINT "role_cadence_organization_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_setting" ADD CONSTRAINT "rule_setting_organization_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_rule_adjustment" ADD CONSTRAINT "user_rule_adjustment_organization_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_rule_adjustment" ADD CONSTRAINT "user_rule_adjustment_owner_fk" FOREIGN KEY ("organization_id","owner_id") REFERENCES "public"."membership"("organization_id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_organization_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_owner_fk" FOREIGN KEY ("organization_id","owner_id") REFERENCES "public"."membership"("organization_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_plan" ADD CONSTRAINT "account_plan_organization_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_plan" ADD CONSTRAINT "account_plan_account_fk" FOREIGN KEY ("organization_id","owner_id","account_id") REFERENCES "public"."account"("organization_id","owner_id","id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "person" ADD CONSTRAINT "person_organization_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person" ADD CONSTRAINT "person_account_fk" FOREIGN KEY ("organization_id","owner_id","account_id") REFERENCES "public"."account"("organization_id","owner_id","id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "relationship" ADD CONSTRAINT "relationship_organization_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationship" ADD CONSTRAINT "relationship_person_fk" FOREIGN KEY ("organization_id","owner_id","person_id") REFERENCES "public"."person"("organization_id","owner_id","id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "signal" ADD CONSTRAINT "signal_organization_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signal" ADD CONSTRAINT "signal_account_fk" FOREIGN KEY ("organization_id","owner_id","account_id") REFERENCES "public"."account"("organization_id","owner_id","id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "signal" ADD CONSTRAINT "signal_person_fk" FOREIGN KEY ("organization_id","owner_id","person_id") REFERENCES "public"."person"("organization_id","owner_id","id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "close_plan_step" ADD CONSTRAINT "close_plan_step_organization_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "close_plan_step" ADD CONSTRAINT "close_plan_step_deal_fk" FOREIGN KEY ("organization_id","owner_id","deal_id") REFERENCES "public"."deal"("organization_id","owner_id","id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "deal" ADD CONSTRAINT "deal_organization_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal" ADD CONSTRAINT "deal_account_fk" FOREIGN KEY ("organization_id","owner_id","account_id") REFERENCES "public"."account"("organization_id","owner_id","id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "deal" ADD CONSTRAINT "deal_stage_fk" FOREIGN KEY ("organization_id","stage_id") REFERENCES "public"."pipeline_stage"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_event" ADD CONSTRAINT "deal_event_organization_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_event" ADD CONSTRAINT "deal_event_deal_fk" FOREIGN KEY ("organization_id","owner_id","deal_id") REFERENCES "public"."deal"("organization_id","owner_id","id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "deal_qualification" ADD CONSTRAINT "deal_qualification_organization_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_qualification" ADD CONSTRAINT "deal_qualification_deal_fk" FOREIGN KEY ("organization_id","owner_id","deal_id") REFERENCES "public"."deal"("organization_id","owner_id","id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "deal_qualification" ADD CONSTRAINT "deal_qualification_criterion_fk" FOREIGN KEY ("organization_id","criterion_key") REFERENCES "public"."qualification_criterion"("organization_id","key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_stakeholder" ADD CONSTRAINT "deal_stakeholder_organization_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_stakeholder" ADD CONSTRAINT "deal_stakeholder_deal_fk" FOREIGN KEY ("organization_id","owner_id","deal_id") REFERENCES "public"."deal"("organization_id","owner_id","id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "deal_stakeholder" ADD CONSTRAINT "deal_stakeholder_person_fk" FOREIGN KEY ("organization_id","owner_id","person_id") REFERENCES "public"."person"("organization_id","owner_id","id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "action" ADD CONSTRAINT "action_organization_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action" ADD CONSTRAINT "action_account_fk" FOREIGN KEY ("organization_id","owner_id","account_id") REFERENCES "public"."account"("organization_id","owner_id","id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "action" ADD CONSTRAINT "action_deal_fk" FOREIGN KEY ("organization_id","owner_id","deal_id") REFERENCES "public"."deal"("organization_id","owner_id","id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "action" ADD CONSTRAINT "action_person_fk" FOREIGN KEY ("organization_id","owner_id","person_id") REFERENCES "public"."person"("organization_id","owner_id","id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "capture_proposal" ADD CONSTRAINT "capture_proposal_organization_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capture_proposal" ADD CONSTRAINT "capture_proposal_interaction_fk" FOREIGN KEY ("organization_id","owner_id","interaction_id") REFERENCES "public"."interaction"("organization_id","owner_id","id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "interaction" ADD CONSTRAINT "interaction_organization_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interaction" ADD CONSTRAINT "interaction_account_fk" FOREIGN KEY ("organization_id","owner_id","account_id") REFERENCES "public"."account"("organization_id","owner_id","id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "interaction" ADD CONSTRAINT "interaction_deal_fk" FOREIGN KEY ("organization_id","owner_id","deal_id") REFERENCES "public"."deal"("organization_id","owner_id","id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "interaction_participant" ADD CONSTRAINT "interaction_participant_organization_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interaction_participant" ADD CONSTRAINT "interaction_participant_interaction_fk" FOREIGN KEY ("organization_id","owner_id","interaction_id") REFERENCES "public"."interaction"("organization_id","owner_id","id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "interaction_participant" ADD CONSTRAINT "interaction_participant_person_fk" FOREIGN KEY ("organization_id","owner_id","person_id") REFERENCES "public"."person"("organization_id","owner_id","id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "interaction_participant" ADD CONSTRAINT "interaction_participant_user_fk" FOREIGN KEY ("organization_id","user_id") REFERENCES "public"."membership"("organization_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_brief" ADD CONSTRAINT "meeting_brief_organization_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_brief" ADD CONSTRAINT "meeting_brief_interaction_fk" FOREIGN KEY ("organization_id","owner_id","interaction_id") REFERENCES "public"."interaction"("organization_id","owner_id","id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "support_request" ADD CONSTRAINT "support_request_organization_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_request" ADD CONSTRAINT "support_request_deal_fk" FOREIGN KEY ("organization_id","owner_id","deal_id") REFERENCES "public"."deal"("organization_id","owner_id","id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "auth_account_user_id_idx" ON "auth_account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "auth_session_user_id_idx" ON "auth_session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "auth_verification_identifier_idx" ON "auth_verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "invitation_org_email_idx" ON "invitation" USING btree ("organization_id","email");--> statement-breakpoint
CREATE INDEX "membership_user_idx" ON "membership" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "membership_manager_idx" ON "membership" USING btree ("organization_id","manager_user_id");--> statement-breakpoint
CREATE INDEX "notification_user_unread_idx" ON "notification" USING btree ("organization_id","user_id","read_at");--> statement-breakpoint
CREATE INDEX "account_owner_idx" ON "account" USING btree ("organization_id","owner_id","name");--> statement-breakpoint
CREATE INDEX "person_account_idx" ON "person" USING btree ("organization_id","account_id");--> statement-breakpoint
CREATE INDEX "signal_account_idx" ON "signal" USING btree ("organization_id","account_id","detected_at");--> statement-breakpoint
CREATE INDEX "deal_owner_stage_idx" ON "deal" USING btree ("organization_id","owner_id","stage_id");--> statement-breakpoint
CREATE INDEX "deal_account_idx" ON "deal" USING btree ("organization_id","account_id");--> statement-breakpoint
CREATE INDEX "deal_event_deal_idx" ON "deal_event" USING btree ("organization_id","deal_id","occurred_at");--> statement-breakpoint
CREATE INDEX "capture_proposal_pending_idx" ON "capture_proposal" USING btree ("organization_id","owner_id","status");--> statement-breakpoint
CREATE INDEX "interaction_account_idx" ON "interaction" USING btree ("organization_id","account_id","occurred_at");--> statement-breakpoint
CREATE INDEX "interaction_owner_time_idx" ON "interaction" USING btree ("organization_id","owner_id","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_event_entity_idx" ON "audit_event" USING btree ("organization_id","entity","entity_id","at");--> statement-breakpoint
CREATE INDEX "audit_event_at_idx" ON "audit_event" USING btree ("organization_id","at");