ALTER TABLE "organization" ADD COLUMN "sales_profile" text DEFAULT 'generic' NOT NULL;--> statement-breakpoint
ALTER TABLE "organization" ADD CONSTRAINT "organization_sales_profile_known" CHECK ("organization"."sales_profile" IN ('generic', 'industrial_equipment'));
