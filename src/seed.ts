import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './db/schema.js';
import bcrypt from 'bcrypt';

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client, { schema });

async function seed() {
  console.log('Seeding database...');

  // Hash passwords
  const hashedPassword = await bcrypt.hash('password123', 10);

  // Insert sample companies
  await db.insert(schema.companies).values([
    {
      phone: '+1234567890',
      name: 'AutoServices Pro',
      email: 'contact@autoservicespro.com',
      address: '123 Main St, City, State',
      startHour: '08:00:00+00',
      endHour: '18:00:00+00',
    },
  ]);

  // Insert sample customers
  await db.insert(schema.customers).values([
    {
      phone: '+0987654321',
      name: 'John Doe',
      email: 'john@example.com',
      state: 'State',
      city: 'City',
      address: '456 Elm St',
      content: 'Regular customer',
    },
  ]);

  // Insert sample technicians
  await db.insert(schema.technicians).values([
    {
      phone: '+1122334455',
      companyPhone: '+1234567890',
      name: 'Jane Smith',
      email: 'jane@autoservicespro.com',
      available: true,
    },
  ]);

  // Insert sample services
  await db.insert(schema.services).values([
    {
      companyPhone: '+1234567890',
      name: 'Oil Change',
      description: 'Complete oil change service',
      category: 'Maintenance',
      estimatedDurationMinutes: 30,
      active: true,
    },
  ]);

  // Insert sample users
  await db.insert(schema.users).values([
    {
      type: 'company',
      phone: '+1234567890',
      name: 'Admin User',
      email: 'admin@autoservicespro.com',
      passwordHash: hashedPassword,
    },
    {
      type: 'technician',
      phone: '+1122334455',
      name: 'Jane Smith',
      email: 'jane@autoservicespro.com',
      passwordHash: hashedPassword,
    },
  ]);

  console.log('Database seeded successfully!');
  process.exit(0);
}

seed().catch((error) => {
  console.error('Seeding failed:', error);
  process.exit(1);
});