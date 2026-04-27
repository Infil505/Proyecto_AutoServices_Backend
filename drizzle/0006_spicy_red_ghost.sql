CREATE TABLE "push_subscriptions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_phone" text NOT NULL,
	"user_type" text NOT NULL,
	"company_phone" text,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE INDEX "idx_push_subscriptions_user_phone" ON "push_subscriptions" USING btree ("user_phone");--> statement-breakpoint
CREATE INDEX "idx_appointments_company_status" ON "appointments" USING btree ("company_phone","status");