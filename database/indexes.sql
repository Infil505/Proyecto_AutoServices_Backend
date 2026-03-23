-- Database indexes for performance optimization
-- Run these after initial migration

-- Users table indexes
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_type ON users(type);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- Companies table indexes
CREATE INDEX IF NOT EXISTS idx_companies_phone ON companies(phone);
CREATE INDEX IF NOT EXISTS idx_companies_created_at ON companies(created_at);

-- Technicians table indexes
CREATE INDEX IF NOT EXISTS idx_technicians_phone ON technicians(phone);
CREATE INDEX IF NOT EXISTS idx_technicians_company_phone ON technicians(company_phone);
CREATE INDEX IF NOT EXISTS idx_technicians_available ON technicians(available);
CREATE INDEX IF NOT EXISTS idx_technicians_created_at ON technicians(created_at);

-- Customers table indexes
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_state_city ON customers(state, city);
CREATE INDEX IF NOT EXISTS idx_customers_created_at ON customers(created_at);

-- Services table indexes
CREATE INDEX IF NOT EXISTS idx_services_company_phone ON services(company_phone);
CREATE INDEX IF NOT EXISTS idx_services_category ON services(category);
CREATE INDEX IF NOT EXISTS idx_services_active ON services(active);
CREATE INDEX IF NOT EXISTS idx_services_created_at ON services(created_at);

-- Appointments table indexes
CREATE INDEX IF NOT EXISTS idx_appointments_customer_phone ON appointments(customer_phone);
CREATE INDEX IF NOT EXISTS idx_appointments_company_phone ON appointments(company_phone);
CREATE INDEX IF NOT EXISTS idx_appointments_technician_phone ON appointments(technician_phone);
CREATE INDEX IF NOT EXISTS idx_appointments_service_id ON appointments(service_id);
CREATE INDEX IF NOT EXISTS idx_appointments_scheduled_date ON appointments(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_created_at ON appointments(created_at);

-- Coverage zones table indexes
CREATE INDEX IF NOT EXISTS idx_coverage_zones_company_phone ON coverage_zones(company_phone);
CREATE INDEX IF NOT EXISTS idx_coverage_zones_state_city ON coverage_zones(state, city);
CREATE INDEX IF NOT EXISTS idx_coverage_zones_created_at ON coverage_zones(created_at);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_appointments_company_date ON appointments(company_phone, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_appointments_technician_date ON appointments(technician_phone, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_services_company_category ON services(company_phone, category);