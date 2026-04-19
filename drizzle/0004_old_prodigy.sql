CREATE INDEX "idx_appointments_company_phone" ON "appointments" USING btree ("company_phone");--> statement-breakpoint
CREATE INDEX "idx_appointments_technician_phone" ON "appointments" USING btree ("technician_phone");--> statement-breakpoint
CREATE INDEX "idx_appointments_status" ON "appointments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_appointments_created_at" ON "appointments" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_companies_created_at" ON "companies" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_coverage_zones_company_phone" ON "coverage_zones" USING btree ("company_phone");--> statement-breakpoint
CREATE INDEX "idx_services_company_phone" ON "services" USING btree ("company_phone");--> statement-breakpoint
CREATE INDEX "idx_services_active" ON "services" USING btree ("active");--> statement-breakpoint
CREATE INDEX "idx_technicians_company_phone" ON "technicians" USING btree ("company_phone");--> statement-breakpoint
CREATE INDEX "idx_technicians_available" ON "technicians" USING btree ("available");