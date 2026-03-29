import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './db/schema.js';
import bcrypt from 'bcrypt';

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client, { schema });

async function seed() {
  console.log(' Seeding database...\n');

  const hashedPassword = await bcrypt.hash('password123', 10);

  // ─── Companies ───────────────────────────────────────────────────────────────
  await db.insert(schema.companies).values([
    {
      phone: '+1234567890',
      name: 'AutoServices Pro',
      email: 'contact@autoservicespro.com',
      address: '123 Main St, Ciudad',
      startHour: '08:00:00+00',
      endHour: '18:00:00+00',
    },
  ]).onConflictDoNothing();

  // ─── Customers ───────────────────────────────────────────────────────────────
  await db.insert(schema.customers).values([
    {
      phone: '+0987654321',
      name: 'John Doe',
      email: 'john@example.com',
      state: 'State',
      city: 'City',
      address: '456 Elm St',
      content: 'Cliente regular de prueba',
    },
  ]).onConflictDoNothing();

  // ─── Technicians ─────────────────────────────────────────────────────────────
  await db.insert(schema.technicians).values([
    {
      phone: '+1122334455',
      companyPhone: '+1234567890',
      name: 'Jane Smith',
      email: 'jane@autoservicespro.com',
      available: true,
    },
  ]).onConflictDoNothing();

  // ─── Services ────────────────────────────────────────────────────────────────
  await db.insert(schema.services).values([
    {
      companyPhone: '+1234567890',
      name: 'Cambio de Aceite',
      description: 'Servicio completo de cambio de aceite',
      category: 'Mantenimiento',
      estimatedDurationMinutes: 30,
      active: true,
    },
    {
      companyPhone: '+1234567890',
      name: 'Revisión de Frenos',
      description: 'Inspección y ajuste del sistema de frenos',
      category: 'Seguridad',
      estimatedDurationMinutes: 60,
      active: true,
    },
  ]).onConflictDoNothing();

  // ─── Specialties ─────────────────────────────────────────────────────────────
  await db.insert(schema.specialties).values([
    { name: 'Mecánica General', description: 'Reparación y mantenimiento general', active: true },
    { name: 'Electricidad Automotriz', description: 'Sistemas eléctricos y electrónicos', active: true },
  ]).onConflictDoNothing();

  // ─── Users ───────────────────────────────────────────────────────────────────
  // Check existing to avoid duplicates (users table has no unique constraint on phone)
  const existingUsers = await db.select({ phone: schema.users.phone }).from(schema.users);
  const existingPhones = new Set(existingUsers.map(u => u.phone));

  const usersToInsert = [
    {
      type: 'super_admin' as const,
      phone: '+0000000000',
      name: 'Super Admin',
      email: 'superadmin@autoservices.com',
      passwordHash: hashedPassword,
    },
    {
      type: 'company' as const,
      phone: '+1234567890',
      name: 'Admin AutoServices Pro',
      email: 'admin@autoservicespro.com',
      passwordHash: hashedPassword,
    },
    {
      type: 'technician' as const,
      phone: '+1122334455',
      name: 'Jane Smith',
      email: 'jane@autoservicespro.com',
      passwordHash: hashedPassword,
    },
  ].filter(u => !existingPhones.has(u.phone));

  if (usersToInsert.length > 0) {
    await db.insert(schema.users).values(usersToInsert);
  }

  // ─── Summary ─────────────────────────────────────────────────────────────────
  console.log('✅ Base de datos lista.\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  CREDENCIALES DE PRUEBA');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Rol          Teléfono        Contraseña');
  console.log('  ──────────── ─────────────── ───────────');
  console.log('  super_admin  +0000000000     password123');
  console.log('  company      +1234567890     password123');
  console.log('  technician   +1122334455     password123');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  POST /api/v1/auth/login');
  console.log('  { "phone": "...", "password": "password123" }');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  process.exit(0);
}

seed().catch((error) => {
  console.error('❌ Seeding failed:', error);
  process.exit(1);
});
