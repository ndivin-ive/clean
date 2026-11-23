CREATE TYPE "public"."quote_status" AS ENUM('draft', 'sent', 'accepted', 'declined', 'superseded');--> statement-breakpoint
CREATE TABLE "quote" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT app_current_org() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid DEFAULT app_current_user(),
	"owner_id" uuid DEFAULT app_current_user() NOT NULL,
	"deal_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"number" text,
	"revision" smallint DEFAULT 1 NOT NULL,
	"status" "quote_status" DEFAULT 'draft' NOT NULL,
	"title" text NOT NULL,
	"language" "locale" DEFAULT 'fr' NOT NULL,
	"currency" char(3) DEFAULT 'EUR' NOT NULL,
	"valid_until" date NOT NULL,
	"introduction" text,
	"terms" text,
	"recipient_name" text,
	"recipient_email" text,
	"subtotal" numeric(14, 2) DEFAULT 0 NOT NULL,
	"vat_total" numeric(14, 2) DEFAULT 0 NOT NULL,
	"total" numeric(14, 2) DEFAULT 0 NOT NULL,
	"seller_snapshot" jsonb,
	"token_hash" text,
	"sent_at" timestamp with time zone,
	"viewed_at" timestamp with time zone,
	"responded_at" timestamp with time zone,
	"responder_name" text,
	"responder_title" text,
	"decline_reason" text,
	"superseded_by" uuid,
	CONSTRAINT "quote_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "quote_org_id_key" UNIQUE("organization_id","id"),
	CONSTRAINT "quote_org_owner_id_key" UNIQUE("organization_id","owner_id","id"),
	CONSTRAINT "quote_number_revision_key" UNIQUE("organization_id","number","revision"),
	CONSTRAINT "quote_title_not_blank" CHECK (btrim("quote"."title") <> ''),
	CONSTRAINT "quote_currency_format" CHECK ("quote"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "quote_revision_positive" CHECK ("quote"."revision" >= 1),
	CONSTRAINT "quote_totals_non_negative" CHECK ("quote"."subtotal" >= 0 AND "quote"."vat_total" >= 0 AND "quote"."total" >= 0),
	CONSTRAINT "quote_sent_has_number" CHECK ("quote"."status" = 'draft' OR ("quote"."number" IS NOT NULL AND "quote"."sent_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "quote_line" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT app_current_org() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid DEFAULT app_current_user(),
	"owner_id" uuid DEFAULT app_current_user() NOT NULL,
	"quote_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"product_key" text,
	"description" text NOT NULL,
	"quantity" numeric(12, 2) DEFAULT 1 NOT NULL,
	"unit" text,
	"unit_price" numeric(14, 2) NOT NULL,
	"discount_pct" numeric(5, 2) DEFAULT 0 NOT NULL,
	"vat_rate" numeric(5, 2) DEFAULT 20 NOT NULL,
	CONSTRAINT "quote_line_org_id_key" UNIQUE("organization_id","id"),
	CONSTRAINT "quote_line_org_owner_id_key" UNIQUE("organization_id","owner_id","id"),
	CONSTRAINT "quote_line_description_not_blank" CHECK (btrim("quote_line"."description") <> ''),
	CONSTRAINT "quote_line_quantity_positive" CHECK ("quote_line"."quantity" > 0),
	CONSTRAINT "quote_line_price_non_negative" CHECK ("quote_line"."unit_price" >= 0),
	CONSTRAINT "quote_line_discount_range" CHECK ("quote_line"."discount_pct" BETWEEN 0 AND 100),
	CONSTRAINT "quote_line_vat_range" CHECK ("quote_line"."vat_rate" BETWEEN 0 AND 100)
);
--> statement-breakpoint
CREATE TABLE "quote_sequence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT app_current_org() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid DEFAULT app_current_user(),
	"year" smallint NOT NULL,
	"last_number" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "quote_sequence_org_id_key" UNIQUE("organization_id","id"),
	CONSTRAINT "quote_sequence_org_year_key" UNIQUE("organization_id","year")
);
--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "legal_name" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "legal_address" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "legal_id" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "vat_number" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "quote_terms" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "quote_validity_days" smallint DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "default_vat_rate" numeric(5, 2) DEFAULT 20 NOT NULL;--> statement-breakpoint
ALTER TABLE "quote" ADD CONSTRAINT "quote_organization_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote" ADD CONSTRAINT "quote_deal_fk" FOREIGN KEY ("organization_id","owner_id","deal_id") REFERENCES "public"."deal"("organization_id","owner_id","id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "quote" ADD CONSTRAINT "quote_account_fk" FOREIGN KEY ("organization_id","owner_id","account_id") REFERENCES "public"."account"("organization_id","owner_id","id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "quote_line" ADD CONSTRAINT "quote_line_organization_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_line" ADD CONSTRAINT "quote_line_quote_fk" FOREIGN KEY ("organization_id","owner_id","quote_id") REFERENCES "public"."quote"("organization_id","owner_id","id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "quote_sequence" ADD CONSTRAINT "quote_sequence_organization_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "quote_deal_idx" ON "quote" USING btree ("organization_id","deal_id");--> statement-breakpoint
CREATE INDEX "quote_line_quote_idx" ON "quote_line" USING btree ("organization_id","quote_id");--> statement-breakpoint
ALTER TABLE "organization" ADD CONSTRAINT "organization_quote_validity_range" CHECK ("organization"."quote_validity_days" BETWEEN 1 AND 365);--> statement-breakpoint
ALTER TABLE "organization" ADD CONSTRAINT "organization_default_vat_range" CHECK ("organization"."default_vat_rate" BETWEEN 0 AND 100);