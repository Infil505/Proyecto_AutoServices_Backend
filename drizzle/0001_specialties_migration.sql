-- 1. Eliminar columna specialty obsoleta de technicians
ALTER TABLE public.technicians DROP COLUMN IF EXISTS specialty;

-- 2. Crear catálogo global de especialidades
CREATE TABLE IF NOT EXISTS public.specialties (
  id bigserial NOT NULL,
  name text NOT NULL,
  description text,
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT specialties_pkey PRIMARY KEY (id),
  CONSTRAINT specialties_name_unique UNIQUE (name)
) TABLESPACE pg_default;

-- 3. Especialidades requeridas por servicio (N:M)
CREATE TABLE IF NOT EXISTS public.service_specialties (
  service_id bigint NOT NULL,
  specialty_id bigint NOT NULL,
  CONSTRAINT service_specialties_pkey PRIMARY KEY (service_id, specialty_id),
  CONSTRAINT service_specialties_service_fkey FOREIGN KEY (service_id)
    REFERENCES public.services(id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT service_specialties_specialty_fkey FOREIGN KEY (specialty_id)
    REFERENCES public.specialties(id) ON UPDATE CASCADE ON DELETE CASCADE
) TABLESPACE pg_default;

-- 4. Especialidades que tiene un técnico (N:M)
CREATE TABLE IF NOT EXISTS public.technician_specialties (
  technician_phone text NOT NULL,
  specialty_id bigint NOT NULL,
  CONSTRAINT technician_specialties_pkey PRIMARY KEY (technician_phone, specialty_id),
  CONSTRAINT technician_specialties_technician_fkey FOREIGN KEY (technician_phone)
    REFERENCES public.technicians(phone) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT technician_specialties_specialty_fkey FOREIGN KEY (specialty_id)
    REFERENCES public.specialties(id) ON UPDATE CASCADE ON DELETE CASCADE
) TABLESPACE pg_default;

-- 5. Índices
CREATE INDEX IF NOT EXISTS idx_service_specialties_specialty_id
  ON public.service_specialties (specialty_id);

CREATE INDEX IF NOT EXISTS idx_technician_specialties_specialty_id
  ON public.technician_specialties (specialty_id);

CREATE INDEX IF NOT EXISTS idx_technician_specialties_technician
  ON public.technician_specialties (technician_phone);