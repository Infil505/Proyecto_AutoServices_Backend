ALTER TABLE "coverage_zones" ADD COLUMN "technician_phone" text;--> statement-breakpoint
ALTER TABLE "coverage_zones" ADD CONSTRAINT "coverage_zones_technician_phone_technicians_phone_fk" FOREIGN KEY ("technician_phone") REFERENCES "public"."technicians"("phone") ON DELETE set null ON UPDATE no action;
