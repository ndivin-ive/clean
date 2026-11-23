ALTER TABLE "organization" ADD COLUMN "brand_color" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "brand_ink" text;--> statement-breakpoint
ALTER TABLE "organization" ADD CONSTRAINT "organization_brand_color_hex" CHECK ("organization"."brand_color" IS NULL OR "organization"."brand_color" ~ '^#[0-9A-Fa-f]{6}$');--> statement-breakpoint
ALTER TABLE "organization" ADD CONSTRAINT "organization_brand_ink_hex" CHECK ("organization"."brand_ink" IS NULL OR "organization"."brand_ink" ~ '^#[0-9A-Fa-f]{6}$');