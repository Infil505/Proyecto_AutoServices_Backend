-- Migration: add users table for authentication
-- This table was missing from production and is required for all auth flows.

CREATE TABLE IF NOT EXISTS public.users (
  id serial PRIMARY KEY,
  type text NOT NULL CHECK (type = ANY (ARRAY['technician'::text, 'company'::text, 'super_admin'::text])),
  phone text NOT NULL UNIQUE,
  name text NOT NULL,
  email text,
  password_hash text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_phone ON public.users (phone);
CREATE INDEX IF NOT EXISTS idx_users_type ON public.users (type);
