/**
 * One-time fix: applies the missing password_hash DROP NOT NULL migration
 * and marks all Drizzle migrations as applied so `bun run db:migrate` works cleanly.
 *
 * Run once: bun scripts/apply-migrations.ts
 */
import postgres from 'postgres'

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL not set')

const sql = postgres(url)

const migrations = [
  { hash: 'ded8c7a1-a97e-4ecc-b855-7779a868e121', tag: '0000_busy_iron_lad' },
  { hash: 'c090d978-7d89-451c-bb1a-fe254b00baf3', tag: '0001_far_killmonger' },
  { hash: 'ef10f89b-f9b9-44cf-8824-b9d1c71f364a', tag: '0002_confused_white_queen' },
  { hash: '46bdc800-dc3d-484f-bce1-cdfd336647be', tag: '0003_little_wendigo' },
  { hash: '1075fed9-baab-483d-8a16-8ea7df2284b3', tag: '0004_old_prodigy' },
  { hash: '2423af2c-bb4a-4289-9cb1-35bf44f3112c', tag: '0005_bizarre_roughhouse' },
]

try {
  // 1. Apply the actual schema fix
  console.log('Applying: ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL...')
  await sql`ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL`
  console.log('  ✓ password_hash is now nullable')

  // 2. Ensure the Drizzle schema and migrations table exist
  await sql`CREATE SCHEMA IF NOT EXISTS drizzle`
  await sql`
    CREATE TABLE IF NOT EXISTS drizzle."__drizzle_migrations" (
      id SERIAL PRIMARY KEY,
      hash TEXT NOT NULL,
      created_at BIGINT
    )
  `

  // 3. Mark all migrations as applied (skip any already recorded)
  const now = Date.now()
  for (const m of migrations) {
    const exists = await sql`
      SELECT 1 FROM drizzle."__drizzle_migrations" WHERE hash = ${m.hash}
    `
    if (exists.length === 0) {
      await sql`
        INSERT INTO drizzle."__drizzle_migrations" (hash, created_at)
        VALUES (${m.hash}, ${now})
      `
      console.log(`  ✓ Marked ${m.tag} as applied`)
    } else {
      console.log(`  – ${m.tag} already recorded, skipping`)
    }
  }

  console.log('\nDone. You can now run `bun run db:migrate` safely for future migrations.')
} catch (err: any) {
  if (err?.code === '42701') {
    // column already exists / constraint already dropped
    console.log('  – password_hash already nullable, nothing to do')
  } else {
    console.error('Error:', err.message ?? err)
    process.exit(1)
  }
} finally {
  await sql.end()
}
