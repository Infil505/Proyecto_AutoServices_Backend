ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "description" text;--> statement-breakpoint
CREATE INDEX "idx_appointments_appointment_date" ON "appointments" USING btree ("appointmentDate");--> statement-breakpoint
CREATE INDEX "idx_users_phone" ON "users" USING btree ("phone");