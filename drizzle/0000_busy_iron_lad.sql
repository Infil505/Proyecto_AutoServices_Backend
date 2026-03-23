CREATE TABLE "appointments" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_phone" text,
	"company_phone" text NOT NULL,
	"technician_phone" text,
	"appointmentDate" date,
	"start_time" time,
	"status" text DEFAULT 'pending',
	"content" text,
	"metadata" jsonb,
	"embedding" jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"coordinates" jsonb,
	"service_id" integer
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"phone" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"address" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"startHour" time with time zone,
	"endHours" time with time zone
);
--> statement-breakpoint
CREATE TABLE "coverage_zones" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_phone" text NOT NULL,
	"state" text NOT NULL,
	"city" text NOT NULL,
	"zone_name" text,
	"postal_code" text,
	"coordinates" jsonb,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"phone" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text,
	"state" text,
	"city" text,
	"address" text,
	"content" text,
	"metadata" jsonb,
	"embedding" jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_phone" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text,
	"estimated_duration_minutes" integer NOT NULL,
	"active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "technicians" (
	"phone" text PRIMARY KEY NOT NULL,
	"company_phone" text NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"specialty" text,
	"available" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"phone" text NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_customer_phone_customers_phone_fk" FOREIGN KEY ("customer_phone") REFERENCES "public"."customers"("phone") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_company_phone_companies_phone_fk" FOREIGN KEY ("company_phone") REFERENCES "public"."companies"("phone") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_technician_phone_technicians_phone_fk" FOREIGN KEY ("technician_phone") REFERENCES "public"."technicians"("phone") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coverage_zones" ADD CONSTRAINT "coverage_zones_company_phone_companies_phone_fk" FOREIGN KEY ("company_phone") REFERENCES "public"."companies"("phone") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_company_phone_companies_phone_fk" FOREIGN KEY ("company_phone") REFERENCES "public"."companies"("phone") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technicians" ADD CONSTRAINT "technicians_company_phone_companies_phone_fk" FOREIGN KEY ("company_phone") REFERENCES "public"."companies"("phone") ON DELETE no action ON UPDATE no action;